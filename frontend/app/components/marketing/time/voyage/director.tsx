'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  type DirectionalLight,
  FogExp2,
  type HemisphereLight,
  type ShaderMaterial,
} from 'three';

import { type ActivitySlice, seededRandom } from '../time-data';
import { dampFactor } from '../time-keyframes';
import { getTimeUi, type TimeFocus, timeMotion } from '../time-store';

import { lanternFor, latestDrop } from './chip-log';
import { BOW_X } from './hull';
import { voyage } from './state';
import {
  daylight,
  dayProgress,
  exposureFor,
  lanternLevel,
  starLevel,
  sunDirection,
  sunElevation,
} from './time-of-day';
import { GERSTNER_GLSL } from './waves';
import { keepOffIslands, tourKeys } from './world-places';

/** Emphasis per kind for each chapter-04 focus: the focused light rises, the rest dim. */
export function focusTargets(focus: TimeFocus) {
  if (focus === 'human') return { human: 1.7, ai: 0.45, fog: 0 };
  if (focus === 'ai') return { human: 0.45, ai: 1.8, fog: 0 };
  if (focus === 'unattributed') return { human: 0.4, ai: 0.4, fog: 1 };
  return { human: 1, ai: 1, fog: 0 };
}

/** How visible the AI wind is: it blows through the human + AI chapter. */
export function windVisibility(g: number) {
  const rise = Math.min(1, Math.max(0, (g - 2.35) / 0.55));
  const fall = Math.min(1, Math.max(0, (g - 3.55) / 0.5));
  return rise * (1 - fall);
}

const HIGH_SUN = new Color('#ffd7a3');
const LOW_SUN = new Color('#ff9150');
const SKY_DAY = new Color('#b9b0d2');
const SKY_NIGHT = new Color('#4a5684');
const SEA_BOUNCE = new Color('#2a6f78');
const FOG_DAY = new Color('#e5b495');
const FOG_NIGHT = new Color('#121726');
/** Thin haze: the far islands stay crisp against the sky. */
const FOG_DENSITY = 0.000_85;

const TOUR_KEYS = tourKeys();
const MOOR_X = TOUR_KEYS.map((key) => key.moor[0]);
const MOOR_Z = TOUR_KEYS.map((key) => key.moor[1]);

/** Catmull-Rom through evenly spaced values: the ship's course between moorings. */
export function courseAt(values: readonly number[], at: number) {
  const last = values.length - 1;
  const clamped = Math.min(last, Math.max(0, at));
  const index = Math.min(last - 1, Math.floor(clamped));
  const t = clamped - index;
  const p0 = values[Math.max(0, index - 1)] as number;
  const p1 = values[index] as number;
  const p2 = values[index + 1] as number;
  const p3 = values[Math.min(last, index + 2)] as number;
  return (
    0.5 *
    (2 * p1 +
      (p2 - p0) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
      (3 * p1 - p0 - 3 * p2 + p3) * t * t * t)
  );
}

/** How much of each weather the tour position sits under. */
export function weatherAt(at: number) {
  const last = TOUR_KEYS.length - 1;
  const clamped = Math.min(last, Math.max(0, at));
  const index = Math.min(last - 1, Math.floor(clamped));
  const t = clamped - index;
  const blend = t * t * (3 - 2 * t);
  const sky = { aurora: 0, meteors: 0, mist: 0, rain: 0 };
  const from = (TOUR_KEYS[index] as (typeof TOUR_KEYS)[number]).weather;
  const to = (TOUR_KEYS[index + 1] as (typeof TOUR_KEYS)[number]).weather;
  if (from !== 'clear') sky[from] += 1 - blend;
  if (to !== 'clear') sky[to] += blend;
  return sky;
}

/**
 * World mode: the ship sails the tour with the visitor. Her berth follows the tour position
 * along a course through every stop's mooring, kept out of the islands' shallows; she turns
 * onto her course as she moves and holds her heading when she lies to.
 */
function sailTour(delta: number) {
  const [x, z] = keepOffIslands(
    courseAt(MOOR_X, timeMotion.tour),
    courseAt(MOOR_Z, timeMotion.tour)
  );
  const dx = x - voyage.shipX;
  const dz = z - voyage.shipZ;
  const speed = delta > 0 ? Math.hypot(dx, dz) / delta : 0;
  voyage.shipX = x;
  voyage.shipZ = z;
  voyage.way += (Math.min(9, speed) - voyage.way) * dampFactor(delta, 2);
  if (speed > 0.4) {
    // The bow points down local +X: a heading h turns it to (cos h, 0, -sin h).
    const wanted = Math.atan2(-dz, dx);
    let turn = wanted - voyage.shipHeading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    voyage.shipHeading += turn * dampFactor(delta, 1.6);
  }
  const sky = weatherAt(timeMotion.tour);
  const ease = dampFactor(delta, 1.4);
  voyage.mist += (sky.mist - voyage.mist) * ease;
  voyage.rain += (sky.rain - voyage.rain) * ease;
  voyage.aurora += (sky.aurora - voyage.aurora) * ease;
  voyage.meteors += (sky.meteors - voyage.meteors) * ease;
}

/**
 * Runs after the camera rig, before anything draws: turns the clock hand into the sun, the
 * sky, exposure and lantern level; eases the focus emphasis; and fires a lantern each time
 * a demo heartbeat drops a marker into the wake.
 */
export function VoyageDirector({
  slices,
  lanterns,
}: {
  lanterns: number;
  slices: ActivitySlice[];
}) {
  const { gl, scene } = useThree();
  const lastDrop = useRef(-1);
  const fog = useMemo(() => new FogExp2('#e5b495', FOG_DENSITY), []);
  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [fog, scene]);
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    voyage.time += delta;
    // Sailing the story at full speed; drifting slowly among the islands in world mode.
    // In world mode the ship really crosses the sea (below), so the water only drifts.
    const speedTarget = timeMotion.world ? 0.6 : 4.2;
    voyage.speed += (speedTarget - voyage.speed) * dampFactor(delta, 0.8);
    voyage.sea += voyage.speed * delta;
    if (timeMotion.world) sailTour(delta);
    else voyage.way = voyage.speed;
    voyage.hand = timeMotion.hand;
    const elevation = sunElevation(dayProgress(timeMotion.hand));
    voyage.sunElev = elevation;
    voyage.sunDir.set(...sunDirection(elevation));
    voyage.daylight = daylight(elevation);
    voyage.stars = starLevel(elevation);
    voyage.lanterns = lanternLevel(elevation);
    voyage.sunColor
      .copy(LOW_SUN)
      .lerp(HIGH_SUN, Math.min(1, Math.max(0, elevation / 0.16)))
      .multiplyScalar(0.3 + 0.7 * voyage.daylight);

    const target = focusTargets(getTimeUi().focus);
    const ease = dampFactor(delta, 3);
    voyage.human += (target.human - voyage.human) * ease;
    voyage.ai += (target.ai - voyage.ai) * ease;
    voyage.fog += (target.fog - voyage.fog) * ease;

    const drop = latestDrop(slices, timeMotion.hand);
    if (drop && drop.minute !== lastDrop.current) {
      lastDrop.current = drop.minute;
      voyage.pulseLantern = lanternFor(drop, lanterns);
      voyage.pulseAge = 0;
    } else {
      voyage.pulseAge += delta;
    }

    // The opening effect of the place being read: restart its clock when the place changes,
    // hold its level while it stays open, let it die away after.
    const { place } = timeMotion;
    if (place && place !== voyage.fxPlace) {
      voyage.fxPlace = place;
      voyage.fxAge = 0;
      voyage.fxOn = 0;
    }
    voyage.fxAge += delta;
    voyage.fxOn +=
      ((place === voyage.fxPlace && place ? 1 : 0) - voyage.fxOn) * dampFactor(delta, 2.4);
    if (!place && voyage.fxOn < 0.004) voyage.fxPlace = '';

    gl.toneMappingExposure = exposureFor(elevation) * (1 + timeMotion.flash * 0.35);
    fog.color.copy(FOG_NIGHT).lerp(FOG_DAY, voyage.daylight);
    fog.density = FOG_DENSITY + voyage.fog * 0.012 + voyage.mist * 0.0075;
  }, -0.5);
  return null;
}

/**
 * Light: a low warm sun (shadow-casting on capable devices), sky fill from above and a
 * cool bounce off the sea from below. Cyan-teal and gold stay light sources, not paint.
 */
export function VoyageLights({ shadows }: { shadows: boolean }) {
  const sun = useRef<DirectionalLight>(null);
  const hemisphere = useRef<HemisphereLight>(null);
  useFrame(() => {
    const light = sun.current;
    if (light) {
      // The shadow frustum travels with the ship, the one thing close enough to need it.
      light.target.position.set(voyage.shipX, 0, voyage.shipZ);
      light.target.updateMatrixWorld();
      light.position.copy(voyage.sunDir).multiplyScalar(60).add(light.target.position);
      light.color.copy(voyage.sunColor);
      const above = Math.min(1, Math.max(0, (voyage.sunElev + 0.03) / 0.08));
      light.intensity = 3.1 * above;
    }
    const fill = hemisphere.current;
    if (fill) {
      fill.color.copy(SKY_NIGHT).lerp(SKY_DAY, voyage.daylight);
      fill.groundColor.copy(SEA_BOUNCE).multiplyScalar(0.35 + 0.65 * voyage.daylight);
      // Enough fill after sunset that the islands keep their colour, not just an outline.
      fill.intensity = 1.7 + 0.2 * voyage.daylight;
    }
  });
  return (
    <>
      <directionalLight
        castShadow={shadows}
        intensity={3}
        ref={sun}
        shadow-bias={-0.0004}
        shadow-camera-bottom={-16}
        shadow-camera-far={140}
        shadow-camera-left={-18}
        shadow-camera-near={10}
        shadow-camera-right={18}
        shadow-camera-top={22}
        shadow-mapSize-height={shadows ? 2048 : 512}
        shadow-mapSize-width={shadows ? 2048 : 512}
        shadow-normalBias={0.04}
      />
      <hemisphereLight ref={hemisphere} />
    </>
  );
}

/* ---------- sea spray off the bow ---------- */

const SPRAY_VERTEX = /* glsl */ `
${GERSTNER_GLSL}
uniform float uTime;
attribute vec4 seed;
varying float vAlpha;
void main() {
  float age = fract(uTime * (0.55 + seed.y * 0.45) + seed.x);
  float side = seed.z > 0.5 ? 1.0 : -1.0;
  vec3 start = vec3(${(BOW_X - 1.6).toFixed(2)} + seed.w * 2.4, 0.0, side * (0.4 + seed.w * 0.9));
  vec3 normal;
  vec3 berth = (modelMatrix * vec4(start, 1.0)).xyz;
  start.y = gerstner(berth.xz, uTime, 30.0, normal).y + 0.2;
  vec3 velocity = vec3(-1.2 - seed.y * 2.6, 2.2 + seed.x * 2.4, side * (1.4 + seed.y * 2.2));
  vec3 p = start + velocity * age * 1.1 + vec3(0.0, -4.9 * age * age * 1.2, 0.0);
  vAlpha = smoothstep(0.0, 0.12, age) * pow(1.0 - age, 1.6);
  vec4 view = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * view;
  gl_PointSize = (2.0 + seed.x * 4.0) * (1.0 - age * 0.5) * (60.0 / max(1.0, -view.z));
}
`;

const SPRAY_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = smoothstep(0.5, 0.05, length(c));
  gl_FragColor = vec4(uColor, d * vAlpha * 0.55);
  #include <colorspace_fragment>
}
`;

export function Spray({ count }: { count: number }) {
  const material = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const random = seededRandom(424);
    const seeds = new Float32Array(count * 4);
    for (let index = 0; index < seeds.length; index += 1) seeds[index] = random();
    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    buffer.setAttribute('seed', new BufferAttribute(seeds, 4));
    return buffer;
  }, [count]);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uSea: { value: 0 }, uColor: { value: new Color('#f3ece4') } }),
    []
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const live = material.current?.uniforms as typeof uniforms | undefined;
    if (!live?.uTime) return;
    live.uTime.value = voyage.time;
    live.uSea.value = voyage.sea;
    live.uColor.value
      .set('#f3ece4')
      .multiplyScalar((0.25 + 0.75 * voyage.daylight) * Math.min(1, voyage.way / 3));
  });
  return (
    <points frustumCulled={false} geometry={geometry}>
      <shaderMaterial
        depthWrite={false}
        fragmentShader={SPRAY_FRAGMENT}
        ref={material}
        transparent
        uniforms={uniforms}
        vertexShader={SPRAY_VERTEX}
      />
    </points>
  );
}

/* ---------- the AI wind ---------- */

const WIND_VERTEX = /* glsl */ `
uniform float uTime;
attribute vec4 seed;
attribute float tail;
varying float vFade;
void main() {
  float run = fract(uTime * (0.08 + seed.x * 0.06) + seed.y);
  float x = -34.0 + run * 46.0 - tail * (3.0 + seed.z * 4.0);
  float y = 4.0 + seed.z * 15.0 + sin(run * 6.28 + seed.w * 6.0) * 0.6;
  float z = (seed.w - 0.5) * 16.0 * (1.0 - run * 0.55);
  vFade = sin(run * 3.14159) * (1.0 - tail);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(x, y, z, 1.0);
}
`;

const WIND_FRAGMENT = /* glsl */ `
uniform float uOpacity;
varying float vFade;
void main() {
  gl_FragColor = vec4(vec3(0.27, 0.84, 0.78), vFade * uOpacity);
  #include <colorspace_fragment>
}
`;

/**
 * Chapter 04's wind: teal streamers blowing from astern into the sails — the AI agent
 * hooks filling them. Faint while the chapter shows everything, strong when "AI" is in
 * focus, gone elsewhere.
 */
export function AiWind({ count }: { count: number }) {
  const material = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const random = seededRandom(616);
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
    const live = material.current?.uniforms as typeof uniforms | undefined;
    if (!live?.uTime) return;
    live.uTime.value = voyage.time;
    const strength = 0.18 + 0.82 * Math.min(1, Math.max(0, (voyage.ai - 1) / 0.8));
    live.uOpacity.value = windVisibility(timeMotion.current) * strength * 0.75;
  });
  return (
    <lineSegments frustumCulled={false} geometry={geometry}>
      <shaderMaterial
        blending={AdditiveBlending}
        depthWrite={false}
        fragmentShader={WIND_FRAGMENT}
        ref={material}
        transparent
        uniforms={uniforms}
        vertexShader={WIND_VERTEX}
      />
    </lineSegments>
  );
}
