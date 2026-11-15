'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { type ReactNode, useEffect, useMemo, useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  NormalBlending,
  type Points,
  type ShaderMaterial,
} from 'three';

import { seededRandom } from '../time-data';

import { fxBurst, placeFx, voyage } from './state';
import { ISLAND_SCALE, placeById } from './world-places';

/**
 * What happens in the world when a place is opened to read. Every place has its own effect,
 * drawn from what the place stands for (owner decision 2026-11-14):
 *
 * - lighthouse (heartbeats): pulse rings travel out over the water, the beam races round
 * - clock tower (one day): the hand whirls through the day, rings ripple out of the dial
 * - twin lights (human + AI): a gold and a teal column of light, sparks spiralling between
 * - market (the product): sky lanterns lift off over the square
 * - ship (begin): she gathers way — rings spread from the hull, spray flies
 * - dock (quick start): welding sparks fountain off the hull on the slip, the crane swings
 * - library (what it is): lit pages spiral up out of the dome
 * - signal mast (compare): flares climb and burst, the flags snap
 * - trading post (pricing): coins arc up from the crates
 * - tavern (questions): fireflies gather, the windows blaze
 *
 * Only the open place draws anything: every part hides itself while its level is zero.
 * The moving parts on the landmarks themselves (beam, hand, crane, flags) live in islands.tsx
 * and read the same `placeFx` clock.
 */

const PLATEAU = 3.6;

/* ---------- particles ---------- */

const POINTS_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uLevel;
uniform float uPixel;
uniform float uLife;
uniform float uRise;
uniform float uGravity;
uniform float uSpread;
uniform float uOut;
uniform float uSpin;
uniform float uSize;
uniform vec3 uColorA;
uniform vec3 uColorB;
attribute vec4 seed;
varying float vAlpha;
varying vec3 vColor;
void main() {
  float life = uLife * (0.6 + 0.4 * seed.y);
  float t = fract(uTime / life + seed.x);
  float age = t * life;
  float angle = seed.z * 6.2832 + uSpin * age * (0.5 + seed.w);
  float r = uSpread * (0.15 + 0.85 * seed.w) + uOut * age * (0.4 + 0.6 * seed.x);
  vec3 p = vec3(
    cos(angle) * r,
    uRise * age * (0.55 + 0.45 * seed.y) - 0.5 * uGravity * age * age,
    sin(angle) * r
  );
  vAlpha = smoothstep(0.0, 0.08, t) * pow(1.0 - t, 1.4) * uLevel;
  vColor = mix(uColorA, uColorB, step(0.5, seed.w));
  vec4 view = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * view;
  gl_PointSize = uSize * (0.5 + seed.x) * uPixel / max(1.0, -view.z);
}
`;

const POINTS_FRAGMENT = /* glsl */ `
uniform float uSquare;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float dot = smoothstep(0.5, 0.08, length(c));
  float square = step(abs(c.x), 0.36) * step(abs(c.y), 0.46);
  gl_FragColor = vec4(vColor, mix(dot, square, uSquare) * vAlpha);
  #include <colorspace_fragment>
}
`;

export interface FxPointsProps {
  /** Ordinary blending instead of additive light: the effect reads as matter, not neon. */
  calm?: boolean;
  colors: [string, string];
  count: number;
  /** Downward pull (m/s²): 0 floats, 9 falls like a spark. */
  gravity?: number;
  id: string;
  /** Seconds one particle lives before it starts again. */
  life: number;
  /** Outward speed from the centre line (m/s). */
  out?: number;
  position: [number, number, number];
  rise: number;
  seed: number;
  size: number;
  /** Angular speed around the centre line (rad/s): a spiral. */
  spin?: number;
  /** Radius the particles start within. */
  spread: number;
  /** Paper-like squares instead of soft dots. */
  square?: boolean;
}

/** A looping cloud of lit particles that exists only while its place is open. */
export function FxPoints({
  calm = false,
  colors,
  count,
  gravity = 0,
  id,
  life,
  out = 0,
  position,
  rise,
  seed,
  size,
  spin = 0,
  spread,
  square = false,
}: FxPointsProps) {
  const points = useRef<Points>(null);
  const material = useRef<ShaderMaterial>(null);
  const pixelRatio = useThree((state) => state.gl.getPixelRatio());
  const geometry = useMemo(() => {
    const random = seededRandom(seed);
    const seeds = new Float32Array(count * 4);
    for (let index = 0; index < seeds.length; index += 1) seeds[index] = random();
    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    buffer.setAttribute('seed', new BufferAttribute(seeds, 4));
    return buffer;
  }, [count, seed]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uPixel: { value: 100 },
      uLife: { value: life },
      uRise: { value: rise },
      uGravity: { value: gravity },
      uSpread: { value: spread },
      uOut: { value: out },
      uSpin: { value: spin },
      uSize: { value: size },
      uSquare: { value: square ? 1 : 0 },
      uColorA: { value: new Color(colors[0]) },
      uColorB: { value: new Color(colors[1]) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the two colours, by value
    [colors[0], colors[1], gravity, life, out, rise, size, spin, spread, square]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const cloud = points.current;
    const live = material.current?.uniforms as typeof uniforms | undefined;
    if (!cloud || !live?.uTime) return;
    const { age, on } = placeFx(id);
    cloud.visible = on > 0.004 || !voyage.shown;
    if (!cloud.visible) return;
    live.uTime.value = voyage.time;
    live.uPixel.value = 110 * pixelRatio;
    // A surge as the place opens, then a steady presence while it is being read.
    live.uLevel.value = on * (0.55 + 0.9 * fxBurst(age, 3.5));
  });
  return (
    <points frustumCulled={false} geometry={geometry} position={position} ref={points}>
      <shaderMaterial
        blending={calm ? NormalBlending : AdditiveBlending}
        depthWrite={false}
        fragmentShader={POINTS_FRAGMENT}
        ref={material}
        transparent
        uniforms={uniforms}
        vertexShader={POINTS_VERTEX}
      />
    </points>
  );
}

/* ---------- rings ---------- */

/** Where ring `index` of `count` is in its cycle (0 → 1) at scene time `time`. */
export function ringPhase(time: number, period: number, index: number, count: number) {
  const phase = (time / period + index / count) % 1;
  return phase < 0 ? phase + 1 : phase;
}

/**
 * Rings that grow from a point and fade: flat on the water (`upright` false) or standing on
 * a wall. They loop while the place is open.
 */
export function FxRings({
  calm = false,
  color,
  count = 3,
  id,
  period = 2.6,
  position,
  reach,
  upright = false,
}: {
  calm?: boolean;
  color: string;
  count?: number;
  id: string;
  period?: number;
  position: [number, number, number];
  /** Radius a ring reaches before it has faded. */
  reach: number;
  upright?: boolean;
}) {
  const group = useRef<Group>(null);
  const tint = useMemo(() => new Color(color), [color]);
  useFrame(() => {
    const rings = group.current;
    if (!rings) return;
    const { age, on } = placeFx(id);
    rings.visible = on > 0.004 || !voyage.shown;
    if (!rings.visible) return;
    const level = on * (0.5 + 0.8 * fxBurst(age, 3));
    for (const [index, child] of rings.children.entries()) {
      const phase = ringPhase(voyage.time, period, index, count);
      const mesh = child as Mesh;
      mesh.scale.setScalar(0.04 + phase * reach);
      (mesh.material as MeshBasicMaterial).opacity = (1 - phase) ** 1.6 * level * (calm ? 0.55 : 1);
    }
  });
  return (
    <group position={position} ref={group} rotation={upright ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}>
      {Array.from({ length: count }, (_, index) => (
        <mesh key={index}>
          <ringGeometry args={[0.93, 1, 72]} />
          <meshBasicMaterial
            blending={calm ? NormalBlending : AdditiveBlending}
            color={tint}
            depthWrite={false}
            opacity={0}
            side={DoubleSide}
            toneMapped={calm}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- a column of light ---------- */

export function FxBeam({
  calm = false,
  color,
  height,
  id,
  position,
  radius,
}: {
  calm?: boolean;
  color: string;
  height: number;
  id: string;
  position: [number, number, number];
  radius: number;
}) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshBasicMaterial>(null);
  useFrame(() => {
    const beam = mesh.current;
    if (!beam || !material.current) return;
    const { age, on } = placeFx(id);
    beam.visible = on > 0.004 || !voyage.shown;
    if (!beam.visible) return;
    // The column shoots up as the place opens and breathes while it is read.
    const grown = Math.min(1, age / 0.9);
    beam.scale.set(1, 0.05 + 0.95 * (1 - (1 - grown) ** 3), 1);
    material.current.opacity =
      on * (0.1 + 0.03 * Math.sin(voyage.time * 2.4) + 0.22 * fxBurst(age, 2.5)) * (calm ? 0.6 : 1);
  });
  return (
    <group position={position}>
      <mesh position={[0, 0, 0]} ref={mesh}>
        <cylinderGeometry args={[radius * 0.55, radius, height, 20, 1, true]} />
        <meshBasicMaterial
          blending={calm ? NormalBlending : AdditiveBlending}
          color={color}
          depthWrite={false}
          opacity={0}
          ref={material}
          side={DoubleSide}
          toneMapped={calm}
          transparent
        />
      </mesh>
    </group>
  );
}

/* ---------- one effect per place ---------- */

const GOLD = '#ffb85c';
const TEAL = '#46d6c8';

/** Places an effect in an island's own frame: on its spot, turned toward the ship, scaled. */
function OnIsland({ children, id }: { children: ReactNode; id: string }) {
  const place = placeById(id);
  if (!place) return null;
  return (
    <group
      position={[place.at[0], 0, place.at[1]]}
      rotation={[0, Math.atan2(-place.at[0], -place.at[1]), 0]}
      scale={ISLAND_SCALE}
    >
      {children}
    </group>
  );
}

export function PlaceEffects({ particles }: { particles: number }) {
  const n = (share: number) => Math.max(12, Math.round(particles * share));
  // The ship's effect rides with her, wherever the tour has taken her.
  const berth = useRef<Group>(null);
  useFrame(() => berth.current?.position.set(voyage.shipX, 0, voyage.shipZ));
  return (
    <group>
      {/* Lighthouse — heartbeats: pulses travel out across the sea. */}
      <OnIsland id="lighthouse">
        <FxRings
          color={GOLD}
          count={4}
          id="lighthouse"
          period={3.2}
          position={[0, 0.5, 0]}
          reach={44}
        />
        <FxPoints
          colors={[GOLD, '#fff0c8']}
          count={n(0.5)}
          id="lighthouse"
          life={3.2}
          out={7}
          position={[0, PLATEAU + 16.4, 0]}
          rise={0.4}
          seed={11}
          size={3.4}
          spread={1.4}
        />
      </OnIsland>

      {/* Clock tower — one day: rings ripple out of the dial. */}
      <OnIsland id="clocktower">
        <FxRings
          color={GOLD}
          count={3}
          id="clocktower"
          period={2.4}
          position={[0, PLATEAU + 17.5, 2.75]}
          reach={7.5}
          upright
        />
        <FxPoints
          colors={[GOLD, TEAL]}
          count={n(0.45)}
          id="clocktower"
          life={4}
          position={[0, PLATEAU + 17.5, 2.9]}
          rise={0}
          seed={12}
          size={2.6}
          spin={1.6}
          spread={3.4}
        />
      </OnIsland>

      {/* Twin lights — human + AI: a gold and a teal column, sparks spiralling up between. */}
      <OnIsland id="twinlights">
        <FxBeam
          color={GOLD}
          height={46}
          id="twinlights"
          position={[-5.2, PLATEAU + 32.2, 0.5]}
          radius={0.5}
        />
        <FxBeam
          color={TEAL}
          height={46}
          id="twinlights"
          position={[5.2, PLATEAU + 32.2, 0.5]}
          radius={0.5}
        />
        <FxPoints
          colors={[GOLD, TEAL]}
          count={n(0.8)}
          id="twinlights"
          life={5}
          position={[0, PLATEAU + 8, 0.5]}
          rise={5.5}
          seed={13}
          size={3}
          spin={1.5}
          spread={5.6}
        />
      </OnIsland>

      {/* Market — the product: sky lanterns lift off over the square. */}
      <OnIsland id="market">
        <FxPoints
          colors={['#ff9a4a', '#ffd08a']}
          count={n(0.3)}
          id="market"
          life={9}
          out={0.5}
          position={[0, PLATEAU + 2, 0.6]}
          rise={3.2}
          seed={14}
          size={9}
          spread={9}
        />
        <FxRings
          color="#ffb86a"
          count={2}
          id="market"
          period={3.6}
          position={[0, PLATEAU + 0.2, 0.6]}
          reach={12}
        />
      </OnIsland>

      {/* The ship — begin: she gathers way. */}
      <group ref={berth}>
        <FxRings color={GOLD} count={3} id="ship" period={3} position={[0, 0.6, 0]} reach={40} />
        <FxRings color={TEAL} count={3} id="ship" period={3} position={[-4, 0.6, 0]} reach={26} />
        <FxPoints
          colors={[GOLD, '#fff0c8']}
          count={n(0.5)}
          id="ship"
          life={4.5}
          position={[0, 3, 0]}
          rise={5}
          seed={15}
          size={2.8}
          spin={0.5}
          spread={7}
        />
      </group>

      {/* Dock — quick start: welding sparks off the hull on the slip. */}
      <OnIsland id="dock">
        <FxPoints
          colors={['#ffd27a', '#ff7a2e']}
          count={n(0.9)}
          gravity={9}
          id="dock"
          life={1.5}
          out={3.4}
          position={[0, 3.2, 8]}
          rise={8.5}
          seed={16}
          size={2.4}
          spread={0.4}
        />
      </OnIsland>

      {/* Library — what it is: lit pages spiral up out of the dome. */}
      <OnIsland id="library">
        <FxPoints
          colors={['#fff1d2', '#ffcf86']}
          count={n(0.6)}
          id="library"
          life={7}
          out={0.7}
          position={[0, PLATEAU + 17, 0]}
          rise={3.4}
          seed={17}
          size={4.6}
          spin={1.1}
          spread={3.6}
          square
        />
        <FxBeam
          color="#ffdca0"
          height={30}
          id="library"
          position={[0, PLATEAU + 35, 0]}
          radius={1.5}
        />
      </OnIsland>

      {/* Signal mast — compare: flares climb and burst. */}
      <OnIsland id="signal">
        <FxPoints
          colors={['#ff5a48', '#ffd27a']}
          count={n(0.7)}
          gravity={4.2}
          id="signal"
          life={3}
          out={2.6}
          position={[0, PLATEAU + 18.4, 0]}
          rise={11}
          seed={18}
          size={3}
          spread={0.3}
        />
        <FxRings
          color="#ff8a5a"
          count={2}
          id="signal"
          period={2}
          position={[0, PLATEAU + 18.4, 0]}
          reach={9}
        />
      </OnIsland>

      {/* Trading post — pricing: coins arc up from the crates. */}
      <OnIsland id="trading">
        <FxPoints
          colors={['#ffd24a', '#fff2a8']}
          count={n(0.6)}
          gravity={6.5}
          id="trading"
          life={2.4}
          out={2.2}
          position={[4.1, PLATEAU + 1.4, 6]}
          rise={9}
          seed={19}
          size={3.6}
          spread={0.5}
        />
        <FxRings
          color="#ffd24a"
          count={2}
          id="trading"
          period={2.8}
          position={[4.1, PLATEAU + 0.2, 6]}
          reach={8}
        />
      </OnIsland>

      {/* Tavern — questions: fireflies gather around the warm windows. */}
      <OnIsland id="tavern">
        <FxPoints
          colors={['#e8ff9a', '#ffcf7a']}
          count={n(0.55)}
          id="tavern"
          life={6}
          out={0.3}
          position={[0, PLATEAU + 1.5, 2]}
          rise={0.9}
          seed={20}
          size={2.6}
          spin={0.5}
          spread={10}
        />
        <FxPoints
          colors={['#8c8279', '#b9aa98']}
          count={n(0.15)}
          id="tavern"
          life={5}
          out={0.5}
          position={[2.2, PLATEAU + 8.6, -1]}
          rise={2.6}
          seed={21}
          size={11}
          spread={0.4}
        />
      </OnIsland>
    </group>
  );
}
