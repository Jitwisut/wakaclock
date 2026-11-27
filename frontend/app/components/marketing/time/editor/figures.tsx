'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import {
  BackSide,
  type BufferGeometry,
  type Camera,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  type Group,
  LatheGeometry,
  type Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { dampFactor } from '../time-keyframes';
import { timeMotion } from '../time-store';
import { voyage } from '../voyage/state';
import { tourIndex } from '../voyage/world-places';

import { deskY } from './file-plan';
import { play } from './play';
import { caretAt } from './scene';
import { type Speaker, STORY } from './story';

/**
 * The two figurines of the story (owner decision 2026-11-15): the developer rides along with
 * the gold cursor, the AI's little robot hovers along with the teal one. They walk the file
 * with the tour, turn to the camera when a place is reached, and the one whose line it is
 * waves (or hops). The speech bubble on the page is pinned above `figureHeads`.
 */

/** Where each figurine's head is this frame (world), for the speech bubble. */
export const figureHeads: Record<Speaker, Vector3> = { dev: new Vector3(), bot: new Vector3() };

/** The fastest a figurine walks (m/s): about a stop in four seconds. */
export const MAX_PACE = 16;

/** The figurines are toys: drawn this much larger than a person beside a 1.5 m line. */
const SCALE = 2.25;
/** The developer, at real proportions, a little larger so the face reads from the camera. */
const DEV_SCALE = 2.45;
/** How far beside its cursor each one stands (m, across the line). */
const BESIDE = { dev: -2.3, bot: -2 } as const;

/**
 * Where each one waits on the map view: the developer at the keyboard, the robot by the ring
 * clock — on the desk, in the right half of the hero, clear of its copy. When the tour sets
 * off they hop up onto the file.
 */
export const HOME_SPOT: Record<Speaker, [number, number, number]> = {
  dev: [31, deskY(18), 18],
  bot: [60, deskY(-52), -52],
};

/** How far a figurine has left its home spot for its cursor: 0 on the map, 1 once under way. */
export function leftHome(tour: number) {
  return Math.min(1, Math.max(0, tour * 2.5));
}

/** Whose line it is right now ('' when nobody is speaking). */
export function speakerNow(): '' | Speaker {
  if (play.ended || timeMotion.place || timeMotion.chart) return '';
  const stop = timeMotion.at ? tourIndex(timeMotion.at) : 0;
  if (!timeMotion.at && Math.abs(timeMotion.tour) > 0.02) return '';
  return STORY[stop]?.speaker ?? '';
}

/** Shared walking state for one figurine. */
interface Gait {
  facing: number;
  hearts: number;
  hop: number;
  phase: number;
  ready: boolean;
}

const toCamera = new Vector3();
const goal = new Vector3();

/**
 * Moves a figurine beside its cursor and works out its pose: facing, walk phase, a hop when
 * it has just collected a heart or is speaking.
 */
function step(
  root: Group,
  gait: Gait,
  who: Speaker,
  delta: number,
  cameraPosition: Vector3
): { moving: number; speaking: boolean } {
  const cursor = who === 'dev' ? caretAt.human : caretAt.ai;
  const home = HOME_SPOT[who];
  const away = leftHome(timeMotion.tour);
  const x = home[0] + (cursor.x + BESIDE[who] - home[0]) * away;
  // Up onto the model in a little leap, then along the line.
  const y = home[1] + (cursor.y + 0.2 - home[1]) * away + Math.sin(away * Math.PI) * 8;
  const z = home[2] + (cursor.z - home[2]) * away;
  if (!gait.ready) {
    root.position.set(x, y, z);
    gait.ready = true;
  }
  // A long jump (compass, keys, a new day): appear there rather than run the whole way.
  if (root.position.distanceToSquared(goal.set(x, y, z)) > 160 ** 2) root.position.copy(goal);
  const before = root.position.clone();
  root.position.x += (x - root.position.x) * dampFactor(delta, 6);
  root.position.y += (y - root.position.y) * dampFactor(delta, 10);
  root.position.z += (z - root.position.z) * dampFactor(delta, 8);
  // A walking pace, never a dash: however fast the tour moves, a figurine covers at most
  // MAX_PACE metres a second and catches up on arrival.
  const moved = root.position.distanceTo(before);
  const limit = MAX_PACE * delta;
  if (moved > limit) root.position.lerpVectors(before, root.position, limit / moved);
  const speed = delta > 0 ? before.distanceTo(root.position) / delta : 0;
  const moving = Math.min(1, speed / 6);
  const speaking = speakerNow() === who;
  // Walking: face down the file. Standing at a place: turn to the camera.
  toCamera.copy(cameraPosition).sub(root.position);
  const wanted = moving > 0.2 ? Math.PI : Math.atan2(toCamera.x, toCamera.z);
  let turn = wanted - gait.facing;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  gait.facing += turn * dampFactor(delta, 5);
  root.rotation.y = gait.facing;
  gait.phase += delta * (2 + 9 * moving);
  // A collected heart: the developer jumps for joy.
  if (who === 'dev' && play.hearts.size > gait.hearts) gait.hop = 1;
  gait.hearts = play.hearts.size;
  gait.hop = Math.max(0, gait.hop - delta * 1.8);
  return { moving, speaking };
}

/* ---------- the toys' parts ---------- */

/**
 * The look (owner 2026-11-15: "sharper, bigger, better looking"): collectible vinyl toys —
 * big heads, real faces, soft rounded parts in matte paint, and a thin dark outline round
 * every main part so the silhouette reads crisply from across the desk.
 */
const OUTLINE = 0.045;

function outlineMaterial() {
  const material = new MeshBasicMaterial({ color: '#120d0a', side: BackSide });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\ntransformed += normal * ${OUTLINE.toFixed(3)};`
    );
  };
  material.customProgramCacheKey = () => 'figure-outline';
  return material;
}

function paint(
  color: string,
  roughness = 0.55,
  extra: Partial<MeshStandardMaterialParameters> = {}
) {
  return new MeshStandardMaterial({ color, metalness: 0, roughness, ...extra });
}

/** Builds (and disposes) a figurine's geometry and paint once. */
function useKit<T extends Record<string, BufferGeometry>, M extends Record<string, Material>>(
  build: () => { geometry: T; paint: M }
) {
  const kit = useMemo(() => ({ ...build(), outline: outlineMaterial() }), []); // eslint-disable-line react-hooks/exhaustive-deps -- built once
  useEffect(
    () => () => {
      for (const geometry of Object.values(kit.geometry)) geometry.dispose();
      for (const material of Object.values(kit.paint)) material.dispose();
      kit.outline.dispose();
    },
    [kit]
  );
  return kit;
}

/** A part of a toy: its mesh and, for the silhouette parts, the outline shell round it. */
function Part({
  geometry,
  material,
  outline,
  position,
  rotation,
  scale,
  shadow = true,
}: {
  geometry: BufferGeometry;
  material: Material;
  outline?: Material;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number] | number;
  shadow?: boolean;
}) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh castShadow={shadow} geometry={geometry} material={material} />
      {outline ? <mesh geometry={geometry} material={outline} /> : null}
    </group>
  );
}

/** Eyes close for a moment every few seconds. */
export function blink(seconds: number, offset = 0) {
  const beat = (seconds + offset) % 3.7;
  return beat < 0.12 ? 0.12 : 1;
}

/**
 * The head's shape (owner 2026-11-15: no round face): an egg turned on a lathe, widest at the
 * cheekbones and narrowing to a jaw and chin. One unit tall; the head group scales it.
 */
export const HEAD_PROFILE: readonly [number, number][] = [
  [0, -0.5],
  [0.12, -0.49],
  [0.22, -0.43],
  [0.3, -0.32],
  [0.35, -0.18],
  [0.385, 0],
  [0.395, 0.14],
  [0.375, 0.28],
  [0.31, 0.4],
  [0.2, 0.48],
  [0, 0.52],
];

/** One side's joint angles (radians): hip and knee about x; shoulder and elbow about x, z. */
export interface Joints {
  elbow: [number, number];
  hip: number;
  knee: number;
  shoulder: [number, number];
}

/**
 * The developer's pose, left side then right: legs and arms swing opposite each other with
 * the walk, a knee bends as its leg swings back, and the speaker raises the right arm and
 * waves from the elbow.
 */
export function devPose(phase: number, moving: number, speaking: boolean, time: number) {
  const swing = Math.sin(phase) * 0.55 * moving;
  return [-1, 1].map((side): Joints => {
    const stride = side * swing;
    const knee = Math.max(0, -Math.sin(phase + (side > 0 ? 0 : Math.PI) + 1.1)) * 0.9 * moving;
    if (speaking && side > 0) {
      return { hip: stride, knee, shoulder: [-0.2, 2.55], elbow: [0, 0.45 * Math.sin(time * 7)] };
    }
    return {
      hip: stride,
      knee,
      shoulder: [-stride * 0.8, side * 0.13],
      elbow: [-0.2 - 0.35 * moving, 0],
    };
  });
}

/** The hoodie's body, turned on a lathe: a waist, a chest and broad shoulders. */
const TORSO_PROFILE: readonly [number, number][] = [
  [0, 0],
  [0.31, 0],
  [0.33, 0.12],
  [0.35, 0.35],
  [0.41, 0.62],
  [0.45, 0.82],
  [0.42, 0.93],
  [0.24, 1],
  [0, 1.02],
];

/** How tall the developer stands (model units, before SCALE): about six and a half heads. */
export const DEV_HEIGHT = 3.95;

/** The developer: real proportions — gold hoodie, jeans, glasses, headphones round the neck. */
function Developer() {
  const kit = useKit(() => ({
    geometry: {
      head: new LatheGeometry(
        HEAD_PROFILE.map(([radius, y]) => new Vector2(radius, y)),
        40
      ),
      ear: new SphereGeometry(0.075, 16, 12),
      hair: new SphereGeometry(0.415, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.5),
      quiff: new SphereGeometry(0.2, 24, 16),
      sclera: new SphereGeometry(0.058, 16, 12),
      iris: new SphereGeometry(0.03, 12, 10),
      brow: new RoundedBoxGeometry(0.15, 0.028, 0.03, 2, 0.012),
      nose: new SphereGeometry(0.05, 16, 12),
      mouth: new RoundedBoxGeometry(0.13, 0.018, 0.02, 2, 0.008),
      lens: new TorusGeometry(0.085, 0.012, 6, 4),
      bridge: new CylinderGeometry(0.01, 0.01, 0.08, 6),
      neck: new CylinderGeometry(0.095, 0.11, 0.2, 20),
      phones: new TorusGeometry(0.44, 0.035, 10, 32, Math.PI),
      cup: new CylinderGeometry(0.13, 0.13, 0.1, 20),
      torso: new LatheGeometry(
        TORSO_PROFILE.map(([radius, y]) => new Vector2(radius, y)),
        32
      ),
      shoulders: new CapsuleGeometry(0.16, 0.56, 6, 16),
      hood: new SphereGeometry(0.26, 20, 14),
      pocket: new RoundedBoxGeometry(0.5, 0.2, 0.05, 2, 0.03),
      string: new CylinderGeometry(0.016, 0.016, 0.26, 6),
      hips: new RoundedBoxGeometry(0.6, 0.3, 0.38, 3, 0.1),
      upperArm: new CapsuleGeometry(0.105, 0.42, 6, 16),
      forearm: new CapsuleGeometry(0.092, 0.4, 6, 16),
      hand: new RoundedBoxGeometry(0.13, 0.2, 0.09, 2, 0.04),
      thigh: new CapsuleGeometry(0.135, 0.6, 6, 16),
      shin: new CapsuleGeometry(0.105, 0.62, 6, 16),
      shoe: new RoundedBoxGeometry(0.26, 0.17, 0.48, 3, 0.07),
      sole: new RoundedBoxGeometry(0.28, 0.05, 0.5, 2, 0.02),
    },
    paint: {
      hoodie: paint('#d49c4f', 0.7),
      pocket: paint('#bb853f', 0.75),
      denim: paint('#34405a', 0.8),
      skin: paint('#e7bf98', 0.6, { emissive: '#e7bf98', emissiveIntensity: 0.1 }),
      hair: paint('#2f231c', 0.6),
      ink: paint('#1a130f', 0.4),
      white: paint('#f4f1ea', 0.5),
      frame: paint('#24252b', 0.35, { metalness: 0.4 }),
      phones: paint('#2d313b', 0.45),
      lip: paint('#b06a5d', 0.6),
    },
  }));
  const { geometry: g, outline, paint: p } = kit;
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  /** Shoulder, elbow, hip and knee joints, left then right. */
  const joints = useRef<{
    elbows: (Group | null)[];
    hips: (Group | null)[];
    knees: (Group | null)[];
    shoulders: (Group | null)[];
  }>({ elbows: [], hips: [], knees: [], shoulders: [] });
  const gait = useRef<Gait>({ facing: Math.PI, hop: 0, hearts: 0, phase: 0, ready: false });
  useFrame(({ camera }, rawDelta) => {
    const group = root.current;
    if (!group || !body.current) return;
    const delta = Math.min(rawDelta, 0.1);
    const { moving, speaking } = step(group, gait.current, 'dev', delta, camera.position);
    const { phase, hop } = gait.current;
    const { elbows, hips, knees, shoulders } = joints.current;
    for (const [index, joint] of devPose(phase, moving, speaking, voyage.time).entries()) {
      hips[index]?.rotation.set(joint.hip, 0, 0);
      knees[index]?.rotation.set(joint.knee, 0, 0);
      shoulders[index]?.rotation.set(joint.shoulder[0], 0, joint.shoulder[1]);
      elbows[index]?.rotation.set(joint.elbow[0], 0, joint.elbow[1]);
    }
    body.current.position.y =
      Math.abs(Math.sin(phase)) * 0.05 * moving + Math.sin(hop * Math.PI) * 1.1;
    body.current.rotation.y = Math.sin(phase) * 0.06 * moving;
    if (eyes.current) eyes.current.scale.y = blink(voyage.time);
    // The bubble hangs from the figurine's spot, not its bobbing body: it stays put.
    figureHeads.dev
      .set(0, DEV_HEIGHT + 0.2, 0)
      .multiplyScalar(DEV_SCALE)
      .add(group.position);
  });
  const leg = (side: number, index: number) => (
    <group
      key={`leg${side}`}
      position={[side * 0.17, 1.9, 0]}
      ref={(node) => {
        joints.current.hips[index] = node;
      }}
    >
      <Part geometry={g.thigh} material={p.denim} outline={outline} position={[0, -0.42, 0]} />
      <group
        position={[0, -0.86, 0]}
        ref={(node) => {
          joints.current.knees[index] = node;
        }}
      >
        <Part geometry={g.shin} material={p.denim} outline={outline} position={[0, -0.4, 0]} />
        <Part geometry={g.shoe} material={p.white} outline={outline} position={[0, -0.95, 0.08]} />
        <Part geometry={g.sole} material={p.ink} position={[0, -1.04, 0.08]} shadow={false} />
      </group>
    </group>
  );
  const arm = (side: number, index: number) => (
    <group
      key={`arm${side}`}
      position={[side * 0.5, 2.84, 0]}
      ref={(node) => {
        joints.current.shoulders[index] = node;
      }}
    >
      <Part geometry={g.upperArm} material={p.hoodie} outline={outline} position={[0, -0.3, 0]} />
      <group
        position={[0, -0.6, 0]}
        ref={(node) => {
          joints.current.elbows[index] = node;
        }}
      >
        <Part geometry={g.forearm} material={p.hoodie} outline={outline} position={[0, -0.27, 0]} />
        <Part geometry={g.hand} material={p.skin} outline={outline} position={[0, -0.6, 0]} />
      </group>
    </group>
  );
  return (
    <group ref={root} scale={DEV_SCALE}>
      <group ref={body}>
        {leg(-1, 0)}
        {leg(1, 1)}
        <Part geometry={g.hips} material={p.denim} outline={outline} position={[0, 1.93, 0]} />
        {/* Hoodie: body, shoulders, hood behind the neck, pocket, drawstrings. */}
        <Part
          geometry={g.torso}
          material={p.hoodie}
          outline={outline}
          position={[0, 1.95, 0]}
          scale={[1, 1, 0.6]}
        />
        <Part
          geometry={g.shoulders}
          material={p.hoodie}
          outline={outline}
          position={[0, 2.82, 0]}
          rotation={[0, 0, Math.PI / 2]}
          scale={[1, 1, 0.85]}
        />
        <Part
          geometry={g.hood}
          material={p.hoodie}
          position={[0, 2.98, -0.17]}
          scale={[1.25, 0.6, 0.7]}
        />
        <Part
          geometry={g.pocket}
          material={p.pocket}
          position={[0, 2.22, 0.2]}
          rotation={[-0.08, 0, 0]}
          shadow={false}
        />
        {[-1, 1].map((side) => (
          <Part
            geometry={g.string}
            key={`string${side}`}
            material={p.white}
            position={[side * 0.08, 2.72, 0.25]}
            shadow={false}
          />
        ))}
        {arm(-1, 0)}
        {arm(1, 1)}
        <Part geometry={g.neck} material={p.skin} position={[0, 3.05, 0]} />
        {/* Head: a lathe egg with a jaw and chin, about a sixth and a half of the height. */}
        <group position={[0, 3.46, 0.01]} scale={[0.62, 0.64, 0.68]}>
          <Part geometry={g.head} material={p.skin} outline={outline} />
          {[-1, 1].map((side) => (
            <Part
              geometry={g.ear}
              key={`ear${side}`}
              material={p.skin}
              position={[side * 0.39, 0.02, -0.02]}
              scale={[0.5, 1, 0.8]}
            />
          ))}
          <Part
            geometry={g.hair}
            material={p.hair}
            outline={outline}
            position={[0, 0.1, -0.02]}
            rotation={[-0.22, 0, 0]}
            scale={[1.02, 1.05, 1.08]}
          />
          <Part
            geometry={g.quiff}
            material={p.hair}
            position={[0.08, 0.42, 0.18]}
            rotation={[0.35, 0, -0.25]}
            scale={[1.7, 0.55, 1.1]}
          />
          {/* Face: almond eyes (they blink), brows, nose, mouth, glasses. */}
          <group position={[0, 0.05, 0.33]} ref={eyes}>
            {[-1, 1].map((side) => (
              <group key={`eye${side}`} position={[side * 0.14, 0, 0]}>
                <Part
                  geometry={g.sclera}
                  material={p.white}
                  scale={[1.45, 0.85, 0.5]}
                  shadow={false}
                />
                <Part geometry={g.iris} material={p.ink} position={[0, 0, 0.025]} shadow={false} />
              </group>
            ))}
          </group>
          {[-1, 1].map((side) => (
            <Part
              geometry={g.brow}
              key={`brow${side}`}
              material={p.hair}
              position={[side * 0.14, 0.15, 0.37]}
              rotation={[0, 0, side * -0.1]}
              shadow={false}
            />
          ))}
          <Part
            geometry={g.nose}
            material={p.skin}
            position={[0, -0.06, 0.4]}
            scale={[0.75, 1.3, 1]}
          />
          <Part geometry={g.mouth} material={p.lip} position={[0, -0.24, 0.345]} shadow={false} />
          {[-1, 1].map((side) => (
            <Part
              geometry={g.lens}
              key={`lens${side}`}
              material={p.frame}
              position={[side * 0.14, 0.05, 0.4]}
              rotation={[0, 0, Math.PI / 4]}
              scale={[1.25, 0.95, 1]}
              shadow={false}
            />
          ))}
          <Part
            geometry={g.bridge}
            material={p.frame}
            position={[0, 0.07, 0.41]}
            rotation={[0, 0, Math.PI / 2]}
            shadow={false}
          />
          {/* Headphones over the hair, cups on the ears. */}
          <Part
            geometry={g.phones}
            material={p.phones}
            outline={outline}
            position={[0, 0.06, -0.02]}
          />
          {[-1, 1].map((side) => (
            <Part
              geometry={g.cup}
              key={`cup${side}`}
              material={p.phones}
              outline={outline}
              position={[side * 0.43, 0.02, -0.02]}
              rotation={[0, 0, Math.PI / 2]}
            />
          ))}
        </group>
      </group>
    </group>
  );
}

/** The AI's robot: a white shell with a teal face screen, hovering with the teal cursor. */
function Robot() {
  const kit = useKit(() => ({
    geometry: {
      thruster: new CylinderGeometry(0.3, 0.12, 0.32, 24),
      glow: new CircleGeometry(0.55, 32),
      body: new RoundedBoxGeometry(1.08, 1, 0.88, 4, 0.32),
      panel: new RoundedBoxGeometry(0.6, 0.42, 0.06, 2, 0.08),
      light: new SphereGeometry(0.07, 12, 10),
      arm: new CapsuleGeometry(0.12, 0.34, 6, 12),
      hand: new SphereGeometry(0.15, 16, 12),
      neck: new CylinderGeometry(0.15, 0.15, 0.16, 16),
      head: new RoundedBoxGeometry(1.18, 0.88, 0.92, 4, 0.3),
      screen: new RoundedBoxGeometry(0.94, 0.6, 0.06, 3, 0.14),
      eye: new RoundedBoxGeometry(0.17, 0.22, 0.04, 2, 0.07),
      smile: new TorusGeometry(0.1, 0.022, 8, 20, Math.PI),
      ear: new CylinderGeometry(0.19, 0.19, 0.1, 24),
      antenna: new CylinderGeometry(0.035, 0.035, 0.36, 8),
      ball: new SphereGeometry(0.1, 16, 12),
    },
    paint: {
      shell: paint('#eef1f3', 0.4),
      teal: paint('#5ba89f', 0.45),
      dark: paint('#2a303c', 0.45, { metalness: 0.3 }),
      screen: paint('#141a25', 0.25, { metalness: 0.3 }),
      eye: paint('#7cc9bf', 0.4, { emissive: '#5ba89f', emissiveIntensity: 0.7 }),
      ball: paint('#d6a35f', 0.35, { metalness: 0.5, emissive: '#d6a35f', emissiveIntensity: 0.2 }),
      glow: new MeshBasicMaterial({
        color: '#5ba89f',
        depthWrite: false,
        opacity: 0.22,
        transparent: true,
      }),
    },
  }));
  const { geometry: g, outline, paint: p } = kit;
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const arms = useRef<(Group | null)[]>([]);
  const gait = useRef<Gait>({ facing: Math.PI, hop: 0, hearts: 0, phase: 0, ready: false });
  useFrame(({ camera }, rawDelta) => {
    const group = root.current;
    if (!group || !body.current) return;
    const delta = Math.min(rawDelta, 0.1);
    const { moving, speaking } = step(group, gait.current, 'bot', delta, camera.position);
    // It hovers; while speaking it holds still and only nods, so its words can be read.
    const hover = 0.35 + Math.sin(voyage.time * 2.2) * (speaking ? 0.03 : 0.12);
    body.current.position.y = hover;
    body.current.rotation.z = speaking ? 0 : Math.sin(voyage.time * 1.6) * 0.05;
    body.current.rotation.x = speaking ? Math.sin(voyage.time * 4) * 0.06 : 0.12 * moving;
    if (eyes.current) eyes.current.scale.y = blink(voyage.time, 1.3);
    const [left, right] = arms.current;
    if (left) left.rotation.z = -0.25 - 0.1 * Math.sin(voyage.time * 2);
    // The speaker raises a hand as it talks.
    if (right) right.rotation.z = speaking ? 2.3 + 0.2 * Math.sin(voyage.time * 6) : 0.25;
    figureHeads.bot.set(0, 3.55, 0).multiplyScalar(SCALE).add(group.position);
  });
  return (
    <group ref={root} scale={SCALE}>
      <group ref={body}>
        {/* A soft teal pool under the thruster: it hovers on something. */}
        <mesh
          geometry={g.glow}
          material={p.glow}
          position={[0, 0.1, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        <Part geometry={g.thruster} material={p.dark} outline={outline} position={[0, 0.58, 0]} />
        <Part geometry={g.body} material={p.shell} outline={outline} position={[0, 1.25, 0]} />
        <Part geometry={g.panel} material={p.teal} position={[0, 1.2, 0.44]} shadow={false} />
        <Part geometry={g.light} material={p.eye} position={[0, 1.36, 0.48]} shadow={false} />
        {[-1, 1].map((side, index) => (
          <group
            key={`arm${side}`}
            position={[side * 0.6, 1.5, 0]}
            ref={(node) => {
              arms.current[index] = node;
            }}
            scale={[side, 1, 1]}
          >
            <Part
              geometry={g.arm}
              material={p.shell}
              outline={outline}
              position={[0.06, -0.26, 0]}
            />
            <Part
              geometry={g.hand}
              material={p.teal}
              outline={outline}
              position={[0.1, -0.56, 0]}
            />
          </group>
        ))}
        <Part geometry={g.neck} material={p.dark} position={[0, 1.83, 0]} />
        <group position={[0, 2.32, 0]}>
          <Part geometry={g.head} material={p.shell} outline={outline} />
          <Part geometry={g.screen} material={p.screen} position={[0, 0, 0.44]} shadow={false} />
          <group position={[0, 0.05, 0.48]} ref={eyes}>
            {[-1, 1].map((side) => (
              <Part
                geometry={g.eye}
                key={`eye${side}`}
                material={p.eye}
                position={[side * 0.2, 0, 0]}
                shadow={false}
              />
            ))}
          </group>
          <Part
            geometry={g.smile}
            material={p.eye}
            position={[0, -0.14, 0.48]}
            rotation={[0, 0, Math.PI]}
            shadow={false}
          />
          {[-1, 1].map((side) => (
            <Part
              geometry={g.ear}
              key={`ear${side}`}
              material={p.teal}
              outline={outline}
              position={[side * 0.62, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            />
          ))}
          <Part geometry={g.antenna} material={p.dark} position={[0, 0.6, 0]} />
          <Part geometry={g.ball} material={p.ball} outline={outline} position={[0, 0.82, 0]} />
        </group>
      </group>
    </group>
  );
}

/** Both figurines. */
export function Figures() {
  return (
    <>
      <Developer />
      <Robot />
    </>
  );
}

const speakerAt = new Vector3();
const otherAt = new Vector3();

/**
 * Pins the speech bubble above its speaker's head: projects the head every frame and writes
 * the screen position to CSS custom properties. No React renders per frame.
 */
interface Box {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

/**
 * Where the speech bubble goes (screen px): above the speaker's head (tail down), kept inside
 * the window; never under the place's title card — beside the speaker if there is room
 * (bottom level with its head, and above the other figurine's head when that one stands
 * under it), otherwise above the card.
 */
export function placeBubble({
  bubble,
  card,
  head,
  other,
  viewWidth,
}: {
  bubble: { height: number; width: number };
  card: Box | null;
  head: { x: number; y: number };
  other: { x: number; y: number };
  viewWidth: number;
}): { side: 'above' | 'left'; x: number; y: number } {
  const half = bubble.width / 2 + 12;
  const x = Math.min(viewWidth - half, Math.max(half, head.x));
  const above = { side: 'above' as const, x, y: head.y };
  if (!card) return above;
  const overlaps =
    x + bubble.width / 2 > card.left - 12 &&
    x - bubble.width / 2 < card.right + 12 &&
    head.y > card.top - 12 &&
    head.y - bubble.height - 16 < card.bottom + 12;
  if (!overlaps) return above;
  const edge = Math.min(head.x - 28, card.left - 12);
  if (edge <= bubble.width + 12) return { ...above, y: Math.min(head.y, card.top - 12) };
  const besideX = edge - bubble.width / 2;
  const clear = Math.abs(other.x - besideX) < bubble.width / 2 + 20;
  return { side: 'left', x: besideX, y: clear ? Math.min(head.y + 16, other.y - 14) : head.y + 16 };
}

/** Projects a world point to page pixels through the canvas's real box on the page. */
function toPage(point: Vector3, camera: Camera, box: { height: number; width: number } & Box) {
  point.project(camera);
  return {
    x: box.left + ((point.x + 1) / 2) * box.width,
    y: box.top + ((1 - point.y) / 2) * box.height,
    behind: point.z > 1,
  };
}

/**
 * The width the bubble may use: the window, less the minimap when it stands on the right
 * edge (tablets and desktops), so the bubble never slides under it.
 */
function usableWidth(minimap: HTMLElement | null) {
  const rect = minimap?.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.left < window.innerWidth / 2) return window.innerWidth;
  return rect.left;
}

export function StoryProjector() {
  const { camera, gl } = useThree();
  const bubble = useRef<HTMLElement | null>(null);
  const card = useRef<HTMLElement | null>(null);
  const minimap = useRef<HTMLElement | null>(null);
  /** Where the bubble is drawn, eased toward where it should be: no jitter, no jumps. */
  const shown = useRef({ ready: false, x: 0, y: 0 });
  useFrame((_, rawDelta) => {
    if (!bubble.current?.isConnected) {
      bubble.current = document.querySelector('.tx-story-bubble');
      shown.current.ready = false;
    }
    const element = bubble.current;
    const speaker = element?.dataset.speaker as Speaker | undefined;
    if (!element || !speaker) return;
    if (!card.current?.isConnected) card.current = document.querySelector('.tx-world-card');
    if (!minimap.current?.isConnected) {
      minimap.current = document.querySelector('.tx-world-compass');
    }
    // The canvas can be wider than the window (phones): place by its real box on the page.
    const box = gl.domElement.getBoundingClientRect();
    const speakerHead = toPage(speakerAt.copy(figureHeads[speaker]), camera, box);
    const other = toPage(otherAt.copy(figureHeads[speaker === 'dev' ? 'bot' : 'dev']), camera, box);
    const rect = card.current?.getBoundingClientRect();
    const place = placeBubble({
      bubble: { height: element.offsetHeight, width: element.offsetWidth },
      card: rect && rect.width > 0 ? rect : null,
      head: speakerHead,
      other,
      viewWidth: usableWidth(minimap.current),
    });
    const state = shown.current;
    if (!state.ready) Object.assign(state, { ready: true, x: place.x, y: place.y });
    const ease = dampFactor(Math.min(rawDelta, 0.1), 7);
    state.x += (place.x - state.x) * ease;
    state.y += (place.y - state.y) * ease;
    element.style.setProperty('--sx', `${state.x.toFixed(1)}px`);
    element.style.setProperty('--sy', `${state.y.toFixed(1)}px`);
    // The tail still points at the speaker, as far as the bubble's edge allows.
    const half = element.offsetWidth / 2 + 12;
    const tail = Math.max(-half + 24, Math.min(half - 24, speakerHead.x - state.x));
    element.style.setProperty('--tail', `${tail.toFixed(1)}px`);
    element.dataset.off = String(speakerHead.behind);
    element.dataset.side = place.side;
  });
  return null;
}
