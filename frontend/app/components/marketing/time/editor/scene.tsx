'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  FogExp2,
  type Group,
  InstancedBufferAttribute,
  type InstancedMesh,
  type Mesh,
  type MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  type Points,
  type ShaderMaterial,
} from 'three';

import { dotTexture } from '../scene/heartbeats';
import { seededRandom } from '../time-data';
import { dampFactor } from '../time-keyframes';
import { timeMotion } from '../time-store';
import { fxLevel, weatherAt } from '../voyage/director';
import { FxBeam, FxPoints, FxRings } from '../voyage/place-fx';
import { fxBurst, placeFx, voyage } from '../voyage/state';
import { TOUR } from '../voyage/world-places';

import {
  cursorAt,
  GLYPH_COLUMNS,
  GLYPH_CUBE,
  glyphCells,
  LINE_GAP,
  lineAtTour,
  LINES,
  lineY,
  lineZ,
  stopBase,
  TEXT_LEFT,
  TEXT_RIGHT,
  type TokenKind,
} from './file-plan';

/**
 * The editor world's scene: the file as a landscape of steps and coloured token bars, the
 * visitor's gold cursor and the AI's teal one, and a landmark glyph for every place. Gold is
 * the human, sea-teal is the AI, as everywhere else on the site.
 */

export const VOID = '#070a12';
const GOLD = '#f2b35e';
const TEAL = '#4fc9bd';

const TOKEN_COLOURS: Record<TokenKind, string> = {
  keyword: '#f2b35e',
  name: '#e9e2d6',
  string: '#7fd8c8',
  number: '#e58f7c',
  comment: '#5d6a82',
};

/** Lines the AI's cursor types ahead of the visitor's. */
export const AI_LEAD = 6;

const dummy = new Object3D();

/* ---------- direction: clock, effects, weather ---------- */

/**
 * Runs after the camera rig: advances the scene clock, the open place's effect, the weather
 * along the tour and how much of the file has been typed. The editor's night never changes,
 * so there is no sun to move.
 */
export function EditorDirector() {
  const { gl, scene } = useThree();
  const opened = useRef('');
  const fog = useMemo(() => new FogExp2(VOID, 0.0038), []);
  const chart = useRef(0);
  useEffect(() => {
    const before = scene.background;
    scene.background = new Color(VOID);
    scene.fog = fog;
    return () => {
      scene.background = before;
      scene.fog = null;
    };
  }, [fog, scene]);
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    voyage.time += delta;
    voyage.daylight = 0;
    voyage.lanterns = 1;
    voyage.reached = Math.max(voyage.reached, timeMotion.tour);

    const { at, place } = timeMotion;
    const playing = place || at;
    if (playing && playing !== voyage.fxPlace) {
      voyage.fxPlace = playing;
      voyage.fxAge = 0;
      voyage.fxOn = 0;
      opened.current = '';
    }
    if (place && opened.current !== place) {
      opened.current = place;
      voyage.fxAge = 0;
    }
    if (!place) opened.current = '';
    voyage.fxAge += delta;
    voyage.fxOn += (fxLevel(place, at, voyage.fxPlace) - voyage.fxOn) * dampFactor(delta, 2.4);
    if (!playing && voyage.fxOn < 0.004) voyage.fxPlace = '';

    const sky = weatherAt(timeMotion.tour);
    const settle = dampFactor(delta, 1.4);
    voyage.mist += (sky.mist - voyage.mist) * settle;
    voyage.rain += (sky.rain - voyage.rain) * settle;
    voyage.aurora += (sky.aurora - voyage.aurora) * settle;
    voyage.meteors += (sky.meteors - voyage.meteors) * settle;

    // From the whole-file view the haze would hide the far end: clear it.
    chart.current += ((timeMotion.chart ? 1 : 0) - chart.current) * dampFactor(delta, 2);
    fog.density = (0.0038 + voyage.mist * 0.006) * (1 - 0.9 * chart.current);
    gl.toneMappingExposure = 1.05;
  }, -0.5);
  return (
    <>
      <ambientLight color="#8f9bc4" intensity={0.9} />
      <hemisphereLight args={['#9aa8d8', '#1a1410', 0.9]} />
      <directionalLight color="#ffe1b4" intensity={1.5} position={[40, 70, 50]} />
    </>
  );
}

/** Distant points of light behind the file, so the void has depth. They travel with the camera. */
export function Starfield({ count = 700 }: { count?: number }) {
  const stars = useRef<Points>(null);
  const geometry = useMemo(() => {
    const random = seededRandom(51);
    const position = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const around = random() * Math.PI * 2;
      const up = random() * 1.3 - 0.25;
      position.set(
        [
          Math.cos(around) * Math.cos(up) * 1500,
          Math.sin(up) * 1500,
          Math.sin(around) * Math.cos(up) * 1500,
        ],
        index * 3
      );
    }
    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(position, 3));
    return buffer;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ camera }) => stars.current?.position.copy(camera.position));
  return (
    <points frustumCulled={false} geometry={geometry} ref={stars} renderOrder={-9}>
      <pointsMaterial
        color="#a9b6d6"
        depthWrite={false}
        fog={false}
        opacity={0.75}
        size={1.7}
        sizeAttenuation={false}
        transparent
      />
    </points>
  );
}

/* ---------- the file ---------- */

const TOKEN_VERTEX = /* glsl */ `
uniform float uTyped;
attribute vec3 aColor;
attribute vec2 aLine;
varying vec3 vColor;
varying vec3 vNormal;
varying float vTyped;
varying float vFresh;
varying float vDistance;
void main() {
  // A token ahead of the cursor is a faint outline of itself; it rises as it is typed. The
  // AI's lines are typed a few lines ahead of the visitor's cursor.
  float written = uTyped + aLine.y * ${AI_LEAD.toFixed(1)} - aLine.x;
  float typed = smoothstep(0.0, 1.4, written);
  float pop = typed + sin(typed * 3.14159) * 0.3;
  vec3 p = position;
  p.y = (p.y + 0.5) * mix(0.14, 1.0, pop) - 0.5;
  vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vColor = aColor;
  vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vTyped = typed;
  // Just typed: it still glows.
  vFresh = typed * (1.0 - smoothstep(1.0, 9.0, written));
  vec4 view = viewMatrix * world;
  vDistance = -view.z;
  gl_Position = projectionMatrix * view;
}
`;

const TOKEN_FRAGMENT = /* glsl */ `
uniform vec3 uVoid;
uniform float uFog;
varying vec3 vColor;
varying vec3 vNormal;
varying float vTyped;
varying float vFresh;
varying float vDistance;
void main() {
  float light = 0.5 + 0.5 * max(0.0, dot(normalize(vNormal), normalize(vec3(0.35, 0.8, 0.45))));
  vec3 colour = vColor * light * mix(0.3, 0.85, vTyped);
  colour += vColor * (0.18 * vTyped + 0.9 * vFresh);
  float haze = 1.0 - exp(-pow(vDistance * uFog, 2.0));
  gl_FragColor = vec4(mix(colour, uVoid, haze), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Every token of the file as one instanced mesh; the shader types them in as the cursor passes. */
function Tokens() {
  const mesh = useRef<InstancedMesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const count = useMemo(() => LINES.reduce((sum, line) => sum + line.tokens.length, 0), []);
  const geometry = useMemo(() => {
    const box = new BoxGeometry(1, 1, 1);
    const colours = new Float32Array(count * 3);
    const lines = new Float32Array(count * 2);
    const colour = new Color();
    const ai = new Color(TEAL);
    let index = 0;
    for (const line of LINES) {
      for (const token of line.tokens) {
        colour.set(TOKEN_COLOURS[token.kind]);
        // The AI's lines lean sea-teal, whatever the token.
        if (line.ai) colour.lerp(ai, 0.62);
        colours.set([colour.r, colour.g, colour.b], index * 3);
        lines.set([line.index, line.ai ? 1 : 0], index * 2);
        index += 1;
      }
    }
    box.setAttribute('aColor', new InstancedBufferAttribute(colours, 3));
    box.setAttribute('aLine', new InstancedBufferAttribute(lines, 2));
    return box;
  }, [count]);
  const uniforms = useMemo(
    () => ({ uTyped: { value: 0 }, uVoid: { value: new Color(VOID) }, uFog: { value: 0.0038 } }),
    []
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    const instance = mesh.current;
    if (!instance) return;
    let index = 0;
    for (const line of LINES) {
      for (const token of line.tokens) {
        dummy.position.set(token.x + token.width / 2, lineY(line.index) + 0.62, lineZ(line.index));
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(token.width, token.kind === 'comment' ? 0.5 : 0.78, LINE_GAP * 0.5);
        dummy.updateMatrix();
        instance.setMatrixAt(index, dummy.matrix);
        index += 1;
      }
    }
    instance.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame(({ scene }) => {
    const live = material.current?.uniforms as typeof uniforms | undefined;
    if (!live?.uTyped) return;
    // Typed stays typed: the file fills up to the furthest line the cursor has reached.
    live.uTyped.value = lineAtTour(voyage.reached) + 1.2;
    live.uFog.value = (scene.fog as FogExp2 | null)?.density ?? 0.0038;
  });
  return (
    <instancedMesh args={[geometry, undefined, count]} frustumCulled={false} ref={mesh}>
      <shaderMaterial
        fragmentShader={TOKEN_FRAGMENT}
        ref={material}
        uniforms={uniforms}
        vertexShader={TOKEN_VERTEX}
      />
    </instancedMesh>
  );
}

/** The steps: one dark plate per line, with a gutter mark at its left end. */
function Steps() {
  const plates = useRef<InstancedMesh>(null);
  const marks = useRef<InstancedMesh>(null);
  const materials = useMemo(
    () => ({
      plate: new MeshStandardMaterial({ color: '#232f4c', metalness: 0.15, roughness: 0.7 }),
      mark: new MeshStandardMaterial({
        color: '#3a4a72',
        emissive: '#5a70a8',
        emissiveIntensity: 0.9,
        roughness: 0.5,
      }),
    }),
    []
  );
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  useEffect(
    () => () => {
      geometry.dispose();
      materials.plate.dispose();
      materials.mark.dispose();
    },
    [geometry, materials]
  );
  useEffect(() => {
    const width = TEXT_RIGHT - TEXT_LEFT + 14;
    for (const line of LINES) {
      const y = lineY(line.index);
      dummy.rotation.set(0, 0, 0);
      // Thick enough that each step closes the gap down to the next.
      dummy.position.set(TEXT_LEFT - 5 + width / 2, y - 1.6, lineZ(line.index));
      dummy.scale.set(width, 3.6, LINE_GAP * 0.94);
      dummy.updateMatrix();
      plates.current?.setMatrixAt(line.index, dummy.matrix);
      // Every fifth line's number is a longer mark, as in a gutter.
      dummy.position.set(TEXT_LEFT - 3.4, y + 0.3, lineZ(line.index));
      dummy.scale.set(line.index % 5 === 0 ? 1.5 : 0.7, 0.16, 0.34);
      dummy.updateMatrix();
      marks.current?.setMatrixAt(line.index, dummy.matrix);
    }
    for (const instance of [plates.current, marks.current]) {
      if (instance) instance.instanceMatrix.needsUpdate = true;
    }
  }, []);
  return (
    <>
      <instancedMesh
        args={[geometry, materials.plate, LINES.length]}
        frustumCulled={false}
        receiveShadow
        ref={plates}
      />
      <instancedMesh
        args={[geometry, materials.mark, LINES.length]}
        frustumCulled={false}
        ref={marks}
      />
    </>
  );
}

export function CodeFile() {
  return (
    <group>
      <Steps />
      <Tokens />
    </group>
  );
}

/* ---------- the cursors ---------- */

/** How bright a caret is `seconds` into its blink: on, then a quick dip, like a heartbeat. */
export function caretBlink(seconds: number) {
  const beat = ((seconds % 1.1) + 1.1) % 1.1;
  return beat < 0.72 ? 1 : 0.28 + 0.72 * Math.abs(Math.cos(((beat - 0.72) / 0.38) * Math.PI));
}

function Caret({ colour, ghost = false, lead }: { colour: string; ghost?: boolean; lead: number }) {
  const caret = useRef<Group>(null);
  const bar = useRef<MeshBasicMaterial>(null);
  const glow = useRef<MeshBasicMaterial>(null);
  const strip = useRef<Mesh>(null);
  const at = useRef({ ready: false, x: 0, y: 0, z: 0 });
  const map = useMemo(() => dotTexture(), []);
  useEffect(() => () => map.dispose(), [map]);
  useFrame((_, rawDelta) => {
    const group = caret.current;
    if (!group) return;
    const delta = Math.min(rawDelta, 0.1);
    // The AI's cursor works a few lines ahead and wanders a little as it goes.
    const wander = ghost ? Math.sin(voyage.time * 0.7) * 1.4 : 0;
    const [x, y, z] = cursorAt(lineAtTour(timeMotion.tour) + lead + wander);
    const { current } = at;
    if (!current.ready) Object.assign(current, { ready: true, x, y, z });
    // It glides along the line rather than snapping from token to token.
    const ease = dampFactor(delta, ghost ? 5 : 9);
    current.x += (x - current.x) * ease;
    current.y += (y - current.y) * dampFactor(delta, 12);
    current.z += (z - current.z) * dampFactor(delta, 14);
    group.position.set(current.x, current.y, current.z);
    const blink = caretBlink(voyage.time + (ghost ? 0.4 : 0));
    if (bar.current) bar.current.opacity = (ghost ? 0.55 : 1) * blink;
    if (glow.current) glow.current.opacity = (ghost ? 0.3 : 0.6) * blink;
    // The current line lights up under the visitor's own cursor.
    if (strip.current) strip.current.position.set(3 - current.x, 0.22, 0);
  });
  return (
    <group ref={caret}>
      <mesh position={[0, 2.1, 0]}>
        <boxGeometry args={[0.24, 3.4, 0.6]} />
        <meshBasicMaterial color={colour} fog={false} ref={bar} toneMapped={false} transparent />
      </mesh>
      <sprite position={[0, 2.1, 0]} scale={[9, 9, 1]}>
        <spriteMaterial
          blending={AdditiveBlending}
          color={colour}
          depthWrite={false}
          fog={false}
          map={map}
          ref={glow as never}
          toneMapped={false}
          transparent
        />
      </sprite>
      {ghost ? null : (
        <mesh ref={strip}>
          <boxGeometry args={[TEXT_RIGHT - TEXT_LEFT + 12, 0.05, LINE_GAP * 0.9]} />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color={colour}
            depthWrite={false}
            opacity={0.1}
            toneMapped={false}
            transparent
          />
        </mesh>
      )}
    </group>
  );
}

/** The visitor's gold cursor and the AI's teal one, working ahead of it. */
export function Cursors() {
  return (
    <>
      <Caret colour={GOLD} lead={0} />
      <Caret colour={TEAL} ghost lead={AI_LEAD} />
    </>
  );
}

/* ---------- landmarks ---------- */

/** Which cubes of a place's glyph are the AI's (sea-teal); the rest are gold. */
export function tealCell(id: string, column: number) {
  if (id === 'twinlights' || id === 'signal') return column > 3;
  return false;
}

/**
 * A place's landmark: its glyph in cubes on a plinth in the margin. From afar it is dim and
 * slightly scattered; as the tour arrives the cubes draw together, and when the place is
 * opened they lock and burn bright.
 */
function Glyph({ id, stop }: { id: string; stop: number }) {
  const cubes = useRef<InstancedMesh>(null);
  const cells = useMemo(() => glyphCells(id), [id]);
  const seeds = useMemo(() => {
    const random = seededRandom(stop * 97 + 5);
    return cells.map(() => [random() - 0.5, random(), random() - 0.5] as const);
  }, [cells, stop]);
  const material = useMemo(
    () => new MeshStandardMaterial({ color: '#ffffff', metalness: 0.3, roughness: 0.38 }),
    []
  );
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const tint = useMemo(() => new Color(), []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );
  useFrame(() => {
    const instance = cubes.current;
    if (!instance) return;
    const { age, on } = placeFx(id);
    // How near the tour is, so the glyph starts gathering before the stop is reached.
    const near = Math.max(0, 1 - Math.abs(timeMotion.tour - stop) * 1.6);
    const gathered = Math.min(1, near * 0.75 + on);
    const loose = (1 - gathered) ** 2;
    const burst = fxBurst(age, 2.6);
    for (const [index, [column, row]] of cells.entries()) {
      const seed = seeds[index] as readonly [number, number, number];
      const bob = Math.sin(voyage.time * 1.3 + index) * 0.12 * (1 - on);
      dummy.position.set(
        (column - (GLYPH_COLUMNS - 1) / 2) * GLYPH_CUBE + seed[0] * 9 * loose,
        3 + (row + 0.5) * GLYPH_CUBE + seed[1] * 7 * loose + bob,
        seed[2] * 12 * loose
      );
      dummy.rotation.set(seed[0] * 3 * loose, seed[1] * 4 * loose, 0);
      dummy.scale.setScalar(GLYPH_CUBE * (0.86 + 0.1 * on + 0.12 * burst));
      dummy.updateMatrix();
      instance.setMatrixAt(index, dummy.matrix);
      tint
        .set(tealCell(id, column) ? TEAL : GOLD)
        .multiplyScalar(0.3 + 0.55 * gathered + 1.5 * on + 1.4 * burst);
      instance.setColorAt(index, tint);
    }
    instance.instanceMatrix.needsUpdate = true;
    if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh args={[geometry, material, cells.length]} frustumCulled={false} ref={cubes} />
  );
}

type FxKind = 'beam' | 'coins' | 'fireflies' | 'pages' | 'pulse' | 'rise' | 'sparks' | 'twin';

/** Each place's own effect, in the spirit of what it stands for. */
const STOP_FX: Record<string, FxKind> = {
  lighthouse: 'pulse',
  clocktower: 'rise',
  twinlights: 'twin',
  market: 'pages',
  ship: 'beam',
  dock: 'sparks',
  library: 'pages',
  signal: 'twin',
  trading: 'coins',
  tavern: 'fireflies',
};

function StopFx({ id, particles, stop }: { id: string; particles: number; stop: number }) {
  const kind = STOP_FX[id] ?? 'rise';
  const top = 3 + (GLYPH_CUBE * 9) / 2;
  const common = { id, seed: stop * 13 + 3 };
  return (
    <>
      <FxRings color={GOLD} count={3} id={id} period={2.6} position={[0, 0.4, 0]} reach={26} />
      {kind === 'pulse' ? (
        <FxRings
          color={GOLD}
          count={4}
          id={id}
          period={1.1}
          position={[0, top, 1.6]}
          reach={13}
          upright
        />
      ) : null}
      {kind === 'twin' ? (
        <>
          <FxBeam color={GOLD} height={60} id={id} position={[-4.2, top + 30, 0]} radius={0.7} />
          <FxBeam color={TEAL} height={60} id={id} position={[4.2, top + 30, 0]} radius={0.7} />
          <FxPoints
            {...common}
            colors={[GOLD, TEAL]}
            count={Math.round(particles * 0.8)}
            life={5}
            position={[0, top, 0]}
            rise={6}
            size={3}
            spin={1.5}
            spread={8}
          />
        </>
      ) : null}
      {kind === 'beam' ? (
        <>
          <FxBeam color={GOLD} height={70} id={id} position={[0, top + 35, 0]} radius={1.6} />
          <FxPoints
            {...common}
            colors={[GOLD, '#fff0c8']}
            count={Math.round(particles * 0.6)}
            life={4}
            out={3}
            position={[0, top, 0]}
            rise={7}
            size={3}
            spread={3}
          />
        </>
      ) : null}
      {kind === 'rise' ? (
        <FxPoints
          {...common}
          colors={[GOLD, TEAL]}
          count={Math.round(particles * 0.6)}
          life={4.5}
          position={[0, top, 0]}
          rise={0.6}
          size={2.8}
          spin={1.7}
          spread={11}
        />
      ) : null}
      {kind === 'pages' ? (
        <FxPoints
          {...common}
          colors={['#fff1d2', GOLD]}
          count={Math.round(particles * 0.7)}
          life={7}
          out={0.8}
          position={[0, top - 4, 0]}
          rise={3.6}
          size={4.8}
          spin={1.1}
          spread={7}
          square
        />
      ) : null}
      {kind === 'sparks' ? (
        <FxPoints
          {...common}
          colors={['#ffd27a', '#ff7a2e']}
          count={Math.round(particles * 0.9)}
          gravity={9}
          life={1.6}
          out={4}
          position={[0, top, 0]}
          rise={10}
          size={2.5}
          spread={1}
        />
      ) : null}
      {kind === 'coins' ? (
        <FxPoints
          {...common}
          colors={['#ffd24a', '#fff2a8']}
          count={Math.round(particles * 0.7)}
          gravity={6.5}
          life={2.6}
          out={3}
          position={[0, top + 4, 0]}
          rise={10}
          size={3.8}
          spread={1}
        />
      ) : null}
      {kind === 'fireflies' ? (
        <FxPoints
          {...common}
          colors={['#e8ff9a', TEAL]}
          count={Math.round(particles * 0.6)}
          life={6}
          out={0.3}
          position={[0, top - 6, 0]}
          rise={1}
          size={2.8}
          spin={0.5}
          spread={13}
        />
      ) : null}
    </>
  );
}

/** Every place's landmark in the margin, turned a little toward the approaching camera. */
export function Landmarks({ particles }: { particles: number }) {
  const material = useMemo(
    () => new MeshStandardMaterial({ color: '#141c2e', metalness: 0.3, roughness: 0.5 }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group>
      {TOUR.map((id, index) => {
        const stop = index + 1;
        const [x, y, z] = stopBase(stop);
        return (
          <group key={id} position={[x, y, z]} rotation={[0, 0.5, 0]}>
            <mesh material={material} position={[0, 0.9, 0]} receiveShadow>
              <boxGeometry args={[GLYPH_COLUMNS * GLYPH_CUBE + 6, 3.4, 7]} />
            </mesh>
            <Glyph id={id} stop={stop} />
            <StopFx id={id} particles={particles} stop={stop} />
          </group>
        );
      })}
    </group>
  );
}
