'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { type ReactNode, useEffect, useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  type Group,
  type LineSegments,
  type Mesh,
  type ShaderMaterial,
} from 'three';

import { seededRandom } from '../time-data';

import { voyage } from './state';

/**
 * Each place keeps its own sky (owner decision 2026-11-14): sea mist round the lighthouse, the
 * aurora over the two lights, a drizzle on the shipyard, shooting stars above the library and
 * the tavern. The director blends the weights along the tour (`voyage.mist` thickens the
 * fog there); this file draws the three that need geometry. Each hides itself at zero.
 */

/* ---------- rain ---------- */

const RAIN_BOX = 70;

const RAIN_VERTEX = /* glsl */ `
uniform float uTime;
attribute vec4 seed;
attribute float tail;
varying float vFade;
void main() {
  // Drops fall through a box that wraps around the camera, slanted by the wind.
  vec3 box = vec3(${RAIN_BOX.toFixed(1)});
  vec3 p = seed.xyz * box;
  p.y -= uTime * (26.0 + seed.w * 10.0);
  p.x += uTime * 5.0;
  p = mod(p - cameraPosition, box) - box * 0.5 + cameraPosition;
  p += vec3(0.22, -1.0, 0.0) * tail * (1.0 + seed.w * 0.8);
  vFade = (1.0 - tail) * (0.4 + 0.6 * seed.w);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const RAIN_FRAGMENT = /* glsl */ `
uniform float uOpacity;
varying float vFade;
void main() {
  // Sea-teal, like characters streaming down a terminal.
  gl_FragColor = vec4(vec3(0.38, 0.86, 0.78), vFade * uOpacity);
  #include <colorspace_fragment>
}
`;

function Rain({ count }: { count: number }) {
  const lines = useRef<LineSegments>(null);
  const material = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const random = seededRandom(733);
    const seeds = new Float32Array(count * 2 * 4);
    const tails = new Float32Array(count * 2);
    for (let index = 0; index < count; index += 1) {
      const seed = [random(), random(), random(), random()];
      seeds.set(seed, index * 8);
      seeds.set(seed, index * 8 + 4);
      tails[index * 2 + 1] = 1;
    }
    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(new Float32Array(count * 2 * 3), 3));
    buffer.setAttribute('seed', new BufferAttribute(seeds, 4));
    buffer.setAttribute('tail', new BufferAttribute(tails, 1));
    return buffer;
  }, [count]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uOpacity: { value: 0 } }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const rain = lines.current;
    const live = material.current?.uniforms as typeof uniforms | undefined;
    if (!rain || !live?.uTime) return;
    rain.visible = voyage.rain > 0.01 || !voyage.shown;
    if (!rain.visible) return;
    live.uTime.value = voyage.time;
    live.uOpacity.value = voyage.rain * 0.75;
  });
  return (
    <lineSegments frustumCulled={false} geometry={geometry} ref={lines}>
      <shaderMaterial
        depthWrite={false}
        fragmentShader={RAIN_FRAGMENT}
        ref={material}
        transparent
        uniforms={uniforms}
        vertexShader={RAIN_VERTEX}
      />
    </lineSegments>
  );
}

/* ---------- aurora ---------- */

const AURORA_VERTEX = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  // The curtain sways: its folds drift round the sky and breathe in and out.
  float fold = sin(uv.x * 38.0 + uTime * 0.25) + 0.6 * sin(uv.x * 91.0 - uTime * 0.4);
  p.xz *= 1.0 + 0.05 * fold * uv.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const AURORA_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float around = vUv.x * 6.2832;
  // Bands in patches of the sky, with fine vertical rays inside them.
  float band = smoothstep(0.15, 0.9, sin(around * 2.0 + uTime * 0.05) * 0.5 + 0.5);
  float rays = 0.55 + 0.45 * sin(vUv.x * 420.0 + sin(vUv.x * 37.0 + uTime * 0.3) * 4.0);
  float height = smoothstep(0.0, 0.18, vUv.y) * pow(1.0 - vUv.y, 1.7);
  // Gold low down, sea-teal above: the two lights of the place it hangs over.
  vec3 gold = vec3(1.0, 0.72, 0.36);
  vec3 teal = vec3(0.27, 0.84, 0.78);
  vec3 colour = mix(gold, teal, smoothstep(0.05, 0.55, vUv.y + 0.12 * sin(around * 5.0)));
  gl_FragColor = vec4(colour, band * rays * height * uOpacity);
  #include <colorspace_fragment>
}
`;

function Aurora() {
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uOpacity: { value: 0 } }), []);
  useFrame(({ camera }) => {
    const curtain = mesh.current;
    const live = material.current?.uniforms as typeof uniforms | undefined;
    if (!curtain || !live?.uTime) return;
    curtain.visible = voyage.aurora > 0.01 || !voyage.shown;
    if (!curtain.visible) return;
    curtain.position.set(camera.position.x, 230, camera.position.z);
    live.uTime.value = voyage.time;
    // It needs a dark sky to show against.
    live.uOpacity.value = voyage.aurora * (0.6 + 0.4 * (1 - voyage.daylight)) * 0.85;
  });
  return (
    <mesh frustumCulled={false} ref={mesh} renderOrder={-8}>
      <cylinderGeometry args={[900, 900, 380, 96, 1, true]} />
      <shaderMaterial
        blending={AdditiveBlending}
        depthTest={false}
        depthWrite={false}
        fragmentShader={AURORA_FRAGMENT}
        ref={material}
        side={BackSide}
        transparent
        uniforms={uniforms}
        vertexShader={AURORA_VERTEX}
      />
    </mesh>
  );
}

/* ---------- shooting stars ---------- */

const METEOR_VERTEX = /* glsl */ `
uniform float uTime;
attribute vec4 seed;
attribute float tail;
varying float vFade;
void main() {
  // Each star waits its turn, then crosses a stretch of the upper sky in under a second.
  float period = 5.0 + seed.w * 7.0;
  float turn = uTime / period + seed.x;
  float run = fract(turn);
  float shot = floor(turn);
  float flight = clamp(run * period / 0.9, 0.0, 1.0);
  float around = (seed.y + shot * 0.37) * 6.2832;
  float up = 0.45 + 0.4 * fract(seed.z + shot * 0.61);
  vec3 from = vec3(cos(around) * cos(up), sin(up), sin(around) * cos(up));
  vec3 along = normalize(vec3(-sin(around), -0.45, cos(around)));
  vec3 p = from * 800.0 + along * (flight * 260.0 - tail * 70.0 * flight);
  vFade = (1.0 - tail) * sin(flight * 3.14159) * step(run * period, 0.9);
  gl_Position = projectionMatrix * viewMatrix * vec4(p + cameraPosition, 1.0);
}
`;

const METEOR_FRAGMENT = /* glsl */ `
uniform float uOpacity;
varying float vFade;
void main() {
  gl_FragColor = vec4(vec3(1.0, 0.95, 0.85), vFade * uOpacity);
  #include <colorspace_fragment>
}
`;

function Meteors({ count }: { count: number }) {
  const lines = useRef<LineSegments>(null);
  const material = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const random = seededRandom(977);
    const seeds = new Float32Array(count * 2 * 4);
    const tails = new Float32Array(count * 2);
    for (let index = 0; index < count; index += 1) {
      const seed = [random(), random(), random(), random()];
      seeds.set(seed, index * 8);
      seeds.set(seed, index * 8 + 4);
      tails[index * 2 + 1] = 1;
    }
    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(new Float32Array(count * 2 * 3), 3));
    buffer.setAttribute('seed', new BufferAttribute(seeds, 4));
    buffer.setAttribute('tail', new BufferAttribute(tails, 1));
    return buffer;
  }, [count]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uOpacity: { value: 0 } }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const stars = lines.current;
    const live = material.current?.uniforms as typeof uniforms | undefined;
    if (!stars || !live?.uTime) return;
    stars.visible = voyage.meteors > 0.01 || !voyage.shown;
    if (!stars.visible) return;
    live.uTime.value = voyage.time;
    live.uOpacity.value = voyage.meteors * (0.55 + 0.45 * (1 - voyage.daylight));
  });
  return (
    <lineSegments frustumCulled={false} geometry={geometry} ref={lines}>
      <shaderMaterial
        blending={AdditiveBlending}
        depthTest={false}
        depthWrite={false}
        fragmentShader={METEOR_FRAGMENT}
        ref={material}
        transparent
        uniforms={uniforms}
        vertexShader={METEOR_VERTEX}
      />
    </lineSegments>
  );
}

export function Weather({ drops }: { drops: number }) {
  return (
    <>
      <Aurora />
      <Meteors count={14} />
      <Rain count={drops} />
    </>
  );
}

/**
 * Everything that sails: the ship, her wake, the chip log, spray and wind. In world mode the
 * director moves her berth along the tour; this group carries the whole fleet there.
 */
export function Fleet({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    const fleet = group.current;
    if (!fleet) return;
    fleet.position.set(voyage.shipX, 0, voyage.shipZ);
    fleet.rotation.y = voyage.shipHeading;
  });
  return <group ref={group}>{children}</group>;
}
