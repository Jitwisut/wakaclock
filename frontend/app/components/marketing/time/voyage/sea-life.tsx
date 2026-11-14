'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  type Group,
  type Mesh,
  type ShaderMaterial,
} from 'three';

import { timeMotion } from '../time-store';

import { courseXZ } from './director';
import { BOW_X } from './hull';
import { voyage } from './state';
import { GERSTNER_GLSL } from './waves';
import { landmark, placeById, TOUR, tourStop } from './world-places';

/**
 * Company on the voyage (owner decision 2026-11-14): the route the ship has sailed, drawn on
 * the sea like the dotted line of a treasure map; dolphins at the bow while she is under
 * way; a whale blowing far off; gulls wheeling over the island ahead. None of it carries
 * information — it is there so the crossing between two places is a passage, not a gap.
 */

/* ---------- the route ---------- */

const ROUTE_SAMPLES = 520;

/** A ribbon along the ship's whole course; `along` is the tour position of each point. */
export function routeGeometry(samples = ROUTE_SAMPLES) {
  const last = TOUR.length;
  const position = new Float32Array((samples + 1) * 2 * 3);
  const along = new Float32Array((samples + 1) * 2);
  const across = new Float32Array((samples + 1) * 2 * 2);
  const index: number[] = [];
  for (let step = 0; step <= samples; step += 1) {
    const at = (step / samples) * last;
    const [x, z] = courseXZ(at);
    const [nx, nz] = courseXZ(Math.min(last, at + 0.01));
    const [px, pz] = courseXZ(Math.max(0, at - 0.01));
    const length = Math.hypot(nx - px, nz - pz) || 1;
    // Perpendicular to the course, on the water.
    const ax = -(nz - pz) / length;
    const az = (nx - px) / length;
    for (const side of [-1, 1]) {
      const vertex = step * 2 + (side < 0 ? 0 : 1);
      position.set([x, 0, z], vertex * 3);
      along[vertex] = at;
      across.set([ax * side, az * side], vertex * 2);
    }
    if (step < samples) {
      const a = step * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('along', new BufferAttribute(along, 1));
  geometry.setAttribute('across', new BufferAttribute(across, 2));
  geometry.setIndex(index);
  return geometry;
}

const ROUTE_VERTEX = /* glsl */ `
${GERSTNER_GLSL}
uniform float uTime;
attribute float along;
attribute vec2 across;
varying float vAlong;
void main() {
  vAlong = along;
  // Wider from higher up, so the line still reads from the sea chart.
  float width = 0.45 + cameraPosition.y * 0.011;
  vec3 p = position;
  p.xz += across * width;
  vec3 normal;
  p += gerstner(p.xz, uTime, length(p.xz - cameraPosition.xz), normal);
  p.y += 0.18;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const ROUTE_FRAGMENT = /* glsl */ `
uniform float uReached;
uniform float uOpacity;
varying float vAlong;
void main() {
  if (vAlong > uReached) discard;
  // Dashes, like the course inked on a chart; the newest stretch is brightest.
  float dash = step(0.42, fract(vAlong * 26.0));
  float fresh = 0.55 + 0.45 * smoothstep(1.2, 0.0, uReached - vAlong);
  gl_FragColor = vec4(vec3(1.0, 0.74, 0.38), dash * fresh * uOpacity);
  #include <colorspace_fragment>
}
`;

export function Route() {
  const material = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => routeGeometry(), []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSea: { value: 0 },
      uReached: { value: 0 },
      uOpacity: { value: 0.8 },
    }),
    []
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const live = material.current?.uniforms as typeof uniforms | undefined;
    if (!live?.uTime) return;
    live.uTime.value = voyage.time;
    live.uSea.value = voyage.sea;
    live.uReached.value = voyage.reached;
    live.uOpacity.value = 0.55 + 0.3 * (1 - voyage.daylight);
  });
  return (
    <mesh frustumCulled={false} geometry={geometry} renderOrder={1}>
      <shaderMaterial
        blending={AdditiveBlending}
        depthWrite={false}
        fragmentShader={ROUTE_FRAGMENT}
        ref={material}
        side={DoubleSide}
        transparent
        uniforms={uniforms}
        vertexShader={ROUTE_VERTEX}
      />
    </mesh>
  );
}

/* ---------- dolphins at the bow ---------- */

const LEAP_PERIOD = 3.4;
const LEAP_SECONDS = 1.2;

/** Height and pitch of a leaping dolphin, `seconds` into its cycle; under water between leaps. */
export function dolphinLeap(seconds: number) {
  const t = ((seconds % LEAP_PERIOD) + LEAP_PERIOD) % LEAP_PERIOD;
  if (t > LEAP_SECONDS) return { forward: 0, pitch: 0, y: -3 };
  const u = t / LEAP_SECONDS;
  return {
    forward: u * 5,
    pitch: Math.cos(u * Math.PI) * 0.95,
    y: Math.sin(u * Math.PI) * 2.3 - 0.5,
  };
}

/** Three dolphins riding the bow wave. They come when the ship is under way and leave when she lies to. */
export function Dolphins() {
  const pod = useRef<Group>(null);
  useFrame(() => {
    const group = pod.current;
    if (!group) return;
    const company = Math.min(1, Math.max(0, (voyage.way - 1.4) / 1.6));
    group.visible = company > 0.02 || !voyage.shown;
    if (!group.visible) return;
    for (const [index, dolphin] of group.children.entries()) {
      const leap = dolphinLeap(voyage.time + index * 1.27);
      dolphin.position.set(
        BOW_X + 4 + index * 2.6 + leap.forward,
        leap.y * company - (1 - company) * 3,
        (index - 1) * 5.2
      );
      dolphin.rotation.z = leap.pitch;
    }
  });
  return (
    <group ref={pod}>
      {[0, 1, 2].map((index) => (
        <group key={index}>
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.34, 1.7, 4, 10]} />
            <meshStandardMaterial color="#3d5568" metalness={0.1} roughness={0.35} />
          </mesh>
          <mesh position={[-0.1, 0.42, 0]} rotation={[0, 0, -0.5]}>
            <coneGeometry args={[0.16, 0.5, 4]} />
            <meshStandardMaterial color="#33485a" roughness={0.4} />
          </mesh>
          <mesh position={[-1.25, 0, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]}>
            <coneGeometry args={[0.42, 0.5, 3]} />
            <meshStandardMaterial color="#33485a" roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------- a whale, far off ---------- */

const WHALE_PERIOD = 26;
const WHALE_SECONDS = 7;

export function Whale() {
  const whale = useRef<Group>(null);
  const spout = useRef<Mesh>(null);
  const lastTurn = useRef(-1);
  useFrame(() => {
    const group = whale.current;
    if (!group) return;
    const turn = Math.floor(voyage.time / WHALE_PERIOD);
    const t = voyage.time - turn * WHALE_PERIOD;
    const up = timeMotion.world && t < WHALE_SECONDS;
    group.visible = up || !voyage.shown;
    if (!up) return;
    if (turn !== lastTurn.current) {
      // She surfaces off the ship's beam, a fair way out, on alternate sides.
      lastTurn.current = turn;
      const side = turn % 2 === 0 ? 1 : -1;
      const cos = Math.cos(voyage.shipHeading);
      const sin = Math.sin(voyage.shipHeading);
      group.position.set(
        voyage.shipX + 46 * cos + side * 62 * sin,
        0,
        voyage.shipZ - 46 * sin + side * 62 * cos
      );
      group.rotation.y = voyage.shipHeading + side * 0.4;
    }
    const u = t / WHALE_SECONDS;
    group.position.y = -2.6 + Math.sin(u * Math.PI) * 2.5;
    group.rotation.z = Math.cos(u * Math.PI) * 0.18;
    if (spout.current) {
      const blow = Math.max(0, Math.sin(((u - 0.28) / 0.3) * Math.PI));
      spout.current.visible = u > 0.28 && u < 0.58;
      spout.current.scale.set(0.6 + blow * 0.6, blow, 0.6 + blow * 0.6);
    }
  });
  return (
    <group ref={whale}>
      <mesh scale={[7.5, 1.7, 2.6]}>
        <sphereGeometry args={[1, 20, 12]} />
        <meshStandardMaterial color="#27333f" roughness={0.45} />
      </mesh>
      <mesh position={[3.4, 1.5, 0]} ref={spout}>
        <coneGeometry args={[1.1, 7, 10, 1, true]} />
        <meshBasicMaterial
          blending={AdditiveBlending}
          color="#e8f2f6"
          depthWrite={false}
          opacity={0.35}
          side={DoubleSide}
          transparent
        />
      </mesh>
    </group>
  );
}

/* ---------- gulls over the island ahead ---------- */

const GULLS = 7;

export function Gulls() {
  const flock = useRef<Group>(null);
  const state = useRef({ presence: 0, x: 0, y: 30, z: 0 });
  useFrame((_, rawDelta) => {
    const group = flock.current;
    if (!group) return;
    const delta = Math.min(rawDelta, 0.1);
    const ease = 1 - Math.exp(-1.6 * delta);
    const place = placeById(tourStop(Math.round(timeMotion.tour)));
    const {current} = state;
    current.presence += ((place && timeMotion.world ? 1 : 0) - current.presence) * ease;
    if (place) {
      const [x, y, z] = landmark(place);
      const shipStop = place.building === 'ship';
      current.x += ((shipStop ? voyage.shipX : x) - current.x) * ease;
      current.y += (y + 9 - current.y) * ease;
      current.z += ((shipStop ? voyage.shipZ : z) - current.z) * ease;
    }
    group.visible = current.presence > 0.02 || !voyage.shown;
    if (!group.visible) return;
    group.position.set(current.x, current.y, current.z);
    for (const [index, gull] of group.children.entries()) {
      const direction = index % 2 === 0 ? 1 : -1;
      const angle = voyage.time * (0.32 + index * 0.03) * direction + index * 0.9;
      const radius = (11 + index * 2.6) * (0.4 + 0.6 * current.presence);
      gull.position.set(
        Math.cos(angle) * radius,
        Math.sin(voyage.time * 0.6 + index) * 1.6 + index * 0.8,
        Math.sin(angle) * radius
      );
      gull.rotation.y = -angle - (direction * Math.PI) / 2;
      gull.scale.setScalar(current.presence);
      const flap = Math.sin(voyage.time * (5 + index * 0.4) + index) * 0.55;
      const [left, right] = gull.children;
      if (left) left.rotation.x = flap;
      if (right) right.rotation.x = -flap;
    }
  });
  return (
    <group ref={flock}>
      {Array.from({ length: GULLS }, (_, index) => (
        <group key={index}>
          {[1, -1].map((side) => (
            <group key={side}>
              <mesh position={[0, 0, side * 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.42, 1.24]} />
                <meshBasicMaterial color="#f3ece1" side={DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}
