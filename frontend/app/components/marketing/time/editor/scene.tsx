'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CustomBlending,
  FogExp2,
  GreaterDepth,
  type Group,
  InstancedBufferAttribute,
  type InstancedMesh,
  type Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OneMinusSrcAlphaFactor,
  type Points,
  SrcAlphaFactor,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

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
  lineNumberBlocks,
  LINES,
  lineY,
  lineZ,
  stopBase,
  TEXT_LEFT,
  TEXT_RIGHT,
  type TokenKind,
} from './file-plan';
import { buildIsland, ISLAND_RADIUS, ISLAND_TOP, looseRocks } from './island';

/**
 * The editor world's scene: the file as a landscape of steps and coloured token bars, the
 * visitor's gold cursor and the AI's teal one, and a landmark glyph on a floating island for
 * every place. Gold is the human, sea-teal is the AI, as everywhere else on the site.
 *
 * Owner direction 2026-11-15: sharp and calm, never neon. Nothing here is additive light;
 * colours are muted, and shapes read through lighting and thin edge lines instead of glow.
 */

export const VOID = '#070a12';
/** Muted, solid versions of the site's gold (human) and sea-teal (AI). */
export const GOLD = '#d6a35f';
export const TEAL = '#5ba89f';

const TOKEN_COLOURS: Record<TokenKind, string> = {
  keyword: '#cf9f60',
  name: '#c4bdb0',
  string: '#76ada2',
  number: '#c98c7c',
  comment: '#56627a',
};

/** Lines the AI's cursor types ahead of the visitor's. */
export const AI_LEAD = 6;

/** How high a plate's top sits above its line's height, and a token's centre above that. */
const PLATE_TOP = 0.2;
const TOKEN_LIFT = 0.42;

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
  const fog = useMemo(() => new FogExp2(VOID, 0.0028), []);
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
    fog.density = (0.0028 + voyage.mist * 0.005) * (1 - 0.9 * chart.current);
    gl.toneMappingExposure = 1;
  }, -0.5);
  // A low fill and a strong key from the upper left, with a cool rim from behind: faces of
  // a box differ clearly, which is most of what makes the scene read sharp.
  return (
    <>
      <ambientLight color="#8f9bc4" intensity={0.35} />
      <hemisphereLight args={['#a4b2dc', '#1a1410', 0.55]} />
      <directionalLight color="#ffe6c2" intensity={2.3} position={[-45, 70, 40]} />
      <directionalLight color="#8aa2d8" intensity={0.7} position={[30, 25, -80]} />
      {/* A faint cool bounce from below, so the islands' undersides keep their shape. */}
      <directionalLight color="#6f7fa8" intensity={0.55} position={[10, -60, 30]} />
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
        opacity={0.6}
        size={1.4}
        sizeAttenuation={false}
        transparent
      />
    </points>
  );
}

/* ---------- the file ---------- */

/** How far a token is typed, shared by the tokens and their reflections. */
const TYPED_GLSL = /* glsl */ `
uniform float uTyped;
attribute vec3 aColor;
attribute vec2 aLine;
float typedAmount(out float written) {
  // A token ahead of the cursor is a faint outline of itself; it rises as it is typed. The
  // AI's lines are typed a few lines ahead of the visitor's cursor.
  written = uTyped + aLine.y * ${AI_LEAD.toFixed(1)} - aLine.x;
  return smoothstep(0.0, 1.4, written);
}
`;

const TOKEN_VERTEX = /* glsl */ `
${TYPED_GLSL}
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vLocal;
varying vec3 vSize;
varying float vTyped;
varying float vFresh;
varying float vDistance;
void main() {
  float written;
  float typed = typedAmount(written);
  float pop = typed + sin(typed * 3.14159) * 0.3;
  float rise = mix(0.14, 1.0, pop);
  vec3 p = position;
  p.y = (p.y + 0.5) * rise - 0.5;
  vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vColor = aColor;
  vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vLocal = position;
  vSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz) * rise, length(instanceMatrix[2].xyz));
  vTyped = typed;
  // Just typed: a brief lift in tone, not a glow.
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
varying vec3 vLocal;
varying vec3 vSize;
varying float vTyped;
varying float vFresh;
varying float vDistance;
void main() {
  vec3 n = normalize(vNormal);
  float key = max(0.0, dot(n, normalize(vec3(-0.45, 0.8, 0.4))));
  float rim = max(0.0, dot(n, normalize(vec3(0.3, 0.3, -0.9))));
  float light = 0.26 + 0.74 * key + 0.15 * rim;
  vec3 colour = vColor * light * mix(0.32, 1.0, vTyped);
  colour = mix(colour, vColor * 1.12, 0.25 * vFresh);
  // A thin ink line round every face: distance (in metres) to the nearest edge of this face.
  vec3 toEdge = (0.5 - abs(vLocal)) * vSize;
  vec3 axis = abs(n);
  float edge = axis.x > 0.5 ? min(toEdge.y, toEdge.z)
    : axis.y > 0.5 ? min(toEdge.x, toEdge.z)
    : min(toEdge.x, toEdge.y);
  float width = fwidth(edge);
  float ink = 1.0 - smoothstep(0.035, 0.035 + width * 1.5, edge);
  colour = mix(colour, colour * 0.42, ink * mix(0.4, 1.0, vTyped));
  float haze = 1.0 - exp(-pow(vDistance * uFog, 2.0));
  gl_FragColor = vec4(mix(colour, uVoid, haze), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * The tokens' reflections in the polished steps: each token mirrored under its own step's
 * surface, faint and fading with depth. They are drawn only where a step is already in front
 * of them (depth test "greater"), so they show on the steps and never in the open void.
 */
const MIRROR_VERTEX = /* glsl */ `
${TYPED_GLSL}
varying vec3 vColor;
varying float vDepth;
varying float vTyped;
varying float vDistance;
void main() {
  float written;
  float typed = typedAmount(written);
  vec3 p = position;
  p.y = (p.y + 0.5) * mix(0.14, 1.0, typed) - 0.5;
  vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
  float surface = instanceMatrix[3].y - ${TOKEN_LIFT.toFixed(2)};
  vDepth = max(0.0, world.y - surface);
  world.y = 2.0 * surface - world.y;
  vColor = aColor;
  vTyped = typed;
  vec4 view = viewMatrix * world;
  vDistance = -view.z;
  gl_Position = projectionMatrix * view;
}
`;

const MIRROR_FRAGMENT = /* glsl */ `
uniform float uFog;
varying vec3 vColor;
varying float vDepth;
varying float vTyped;
varying float vDistance;
void main() {
  float fade = exp(-vDepth * 1.8) * vTyped;
  float haze = exp(-pow(vDistance * uFog, 2.0));
  gl_FragColor = vec4(vColor * 0.85, 0.36 * fade * haze);
  #include <colorspace_fragment>
}
`;

function tokenGeometry(count: number) {
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
      if (line.ai) colour.lerp(ai, 0.6);
      colours.set([colour.r, colour.g, colour.b], index * 3);
      lines.set([line.index, line.ai ? 1 : 0], index * 2);
      index += 1;
    }
  }
  box.setAttribute('aColor', new InstancedBufferAttribute(colours, 3));
  box.setAttribute('aLine', new InstancedBufferAttribute(lines, 2));
  return box;
}

function placeTokens(instance: InstancedMesh) {
  let index = 0;
  for (const line of LINES) {
    for (const token of line.tokens) {
      dummy.position.set(
        token.x + token.width / 2,
        lineY(line.index) + PLATE_TOP + TOKEN_LIFT,
        lineZ(line.index)
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(token.width, token.kind === 'comment' ? 0.5 : 0.78, LINE_GAP * 0.5);
      dummy.updateMatrix();
      instance.setMatrixAt(index, dummy.matrix);
      index += 1;
    }
  }
  instance.instanceMatrix.needsUpdate = true;
}

/** Every token of the file as one instanced mesh; the shader types them in as the cursor passes. */
function Tokens() {
  const mesh = useRef<InstancedMesh>(null);
  const mirror = useRef<InstancedMesh>(null);
  const count = useMemo(() => LINES.reduce((sum, line) => sum + line.tokens.length, 0), []);
  const geometry = useMemo(() => tokenGeometry(count), [count]);
  const uniforms = useMemo(
    () => ({ uTyped: { value: 0 }, uVoid: { value: new Color(VOID) }, uFog: { value: 0.0028 } }),
    []
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    for (const instance of [mesh.current, mirror.current]) {
      if (instance) placeTokens(instance);
    }
  }, []);
  useFrame(({ scene }) => {
    // Typed stays typed: the file fills up to the furthest line the cursor has reached.
    uniforms.uTyped.value = lineAtTour(voyage.reached) + 1.2;
    // Both materials share these uniform objects.
    uniforms.uFog.value = (scene.fog as FogExp2 | null)?.density ?? 0.0028;
  });
  return (
    <>
      <instancedMesh
        args={[geometry, undefined, count]}
        frustumCulled={false}
        ref={mirror}
        renderOrder={-1}
      >
        <shaderMaterial
          blendDst={OneMinusSrcAlphaFactor}
          blending={CustomBlending}
          blendSrc={SrcAlphaFactor}
          depthFunc={GreaterDepth}
          depthWrite={false}
          fragmentShader={MIRROR_FRAGMENT}
          uniforms={uniforms}
          vertexShader={MIRROR_VERTEX}
        />
      </instancedMesh>
      <instancedMesh args={[geometry, undefined, count]} frustumCulled={false} ref={mesh}>
        <shaderMaterial
          fragmentShader={TOKEN_FRAGMENT}
          uniforms={uniforms}
          vertexShader={TOKEN_VERTEX}
        />
      </instancedMesh>
    </>
  );
}

/** The steps: one polished dark plate per line, with a fine lit edge along its front lip. */
function Steps() {
  const plates = useRef<InstancedMesh>(null);
  const lips = useRef<InstancedMesh>(null);
  const materials = useMemo(
    () => ({
      plate: new MeshStandardMaterial({ color: '#1d2740', metalness: 0.25, roughness: 0.42 }),
      lip: new MeshBasicMaterial({ color: '#36425f' }),
    }),
    []
  );
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  useEffect(
    () => () => {
      geometry.dispose();
      materials.plate.dispose();
      materials.lip.dispose();
    },
    [geometry, materials]
  );
  useEffect(() => {
    const width = TEXT_RIGHT - TEXT_LEFT + 14;
    const centre = TEXT_LEFT - 5 + width / 2;
    for (const line of LINES) {
      const y = lineY(line.index);
      const z = lineZ(line.index);
      dummy.rotation.set(0, 0, 0);
      // Thick enough that each step closes the gap down to the next.
      dummy.position.set(centre, y + PLATE_TOP - 1.8, z);
      dummy.scale.set(width, 3.6, LINE_GAP * 0.94);
      dummy.updateMatrix();
      plates.current?.setMatrixAt(line.index, dummy.matrix);
      // The lip: a hairline along the step's nearer top edge, so every step reads crisply.
      dummy.position.set(centre, y + PLATE_TOP + 0.005, z + LINE_GAP * 0.47 - 0.03);
      dummy.scale.set(width, 0.03, 0.06);
      dummy.updateMatrix();
      lips.current?.setMatrixAt(line.index, dummy.matrix);
    }
    for (const instance of [plates.current, lips.current]) {
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
        renderOrder={-2}
      />
      <instancedMesh
        args={[geometry, materials.lip, LINES.length]}
        frustumCulled={false}
        ref={lips}
      />
    </>
  );
}

/** Right edge of the line numbers, just left of the text area. */
const NUMBER_DIM = new Color('#3a4560');
const NUMBER_NEAR = new Color('#5d6a88');
const NUMBER_HERE = new Color(GOLD);

function numberColour(linesAway: number) {
  if (linesAway === 0) return NUMBER_HERE;
  return linesAway <= 3 ? NUMBER_NEAR : NUMBER_DIM;
}

/**
 * The gutter: every line's number, right-aligned, as one small block per digit. Not text,
 * but it reads as line numbers the way an editor's minimap reads as code. The visitor's
 * current line is gold, and the few around it a little brighter.
 */
function LineNumbers() {
  const blocks = useRef<InstancedMesh>(null);
  /** Every digit's block with the line it belongs to. */
  const digits = useMemo(
    () =>
      LINES.flatMap((line) =>
        lineNumberBlocks(line.index).map((block) => ({ ...block, line: line.index }))
      ),
    []
  );
  const material = useMemo(
    () => new MeshStandardMaterial({ color: '#ffffff', metalness: 0.1, roughness: 0.6 }),
    []
  );
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const shown = useRef(-1);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );
  useEffect(() => {
    const instance = blocks.current;
    if (!instance) return;
    for (const [index, { centre, line, width }] of digits.entries()) {
      dummy.position.set(centre, lineY(line) + PLATE_TOP + 0.14, lineZ(line));
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(width, 0.28, 0.62);
      dummy.updateMatrix();
      instance.setMatrixAt(index, dummy.matrix);
      instance.setColorAt(index, NUMBER_DIM);
    }
    instance.instanceMatrix.needsUpdate = true;
    if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
  }, [digits]);
  useFrame(() => {
    const instance = blocks.current;
    if (!instance) return;
    const here = Math.floor(lineAtTour(timeMotion.tour));
    if (here === shown.current) return;
    shown.current = here;
    for (const [index, { line }] of digits.entries()) {
      instance.setColorAt(index, numberColour(Math.abs(line - here)));
    }
    if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh args={[geometry, material, digits.length]} frustumCulled={false} ref={blocks} />
  );
}

export function CodeFile() {
  return (
    <group>
      <Steps />
      <LineNumbers />
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

/**
 * A cursor as a collaborative editor draws one: a solid bar with a small flag at its head.
 * Lit like everything else (no glow), and never fully dark mid-blink, so it is always easy
 * to find. The visitor's also lights their current line, faintly.
 */
function Caret({ colour, ghost = false, lead }: { colour: string; ghost?: boolean; lead: number }) {
  const caret = useRef<Group>(null);
  const at = useRef({ ready: false, x: 0, y: 0, z: 0 });
  const materials = useMemo(
    () => ({
      solid: new MeshStandardMaterial({
        color: colour,
        emissive: colour,
        emissiveIntensity: 0.28,
        metalness: 0.1,
        roughness: 0.45,
        transparent: true,
      }),
      line: new MeshBasicMaterial({
        color: colour,
        depthWrite: false,
        opacity: 0.07,
        transparent: true,
      }),
    }),
    [colour]
  );
  useEffect(
    () => () => {
      materials.solid.dispose();
      materials.line.dispose();
    },
    [materials]
  );
  const strip = useRef<Group>(null);
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
    materials.solid.opacity = (ghost ? 0.85 : 1) * (0.55 + 0.45 * blink);
    // The current line lights up under the visitor's own cursor.
    strip.current?.position.set(3 - current.x, PLATE_TOP + 0.02, 0);
  });
  return (
    <group ref={caret}>
      <mesh material={materials.solid} position={[0, 2.05, 0]}>
        <boxGeometry args={[0.32, 3.3, 0.32]} />
      </mesh>
      <mesh material={materials.solid} position={[0.62, 3.95, 0]}>
        <boxGeometry args={[1.25, 0.62, 0.18]} />
      </mesh>
      {ghost ? null : (
        <group ref={strip}>
          <mesh material={materials.line}>
            <boxGeometry args={[TEXT_RIGHT - TEXT_LEFT + 12, 0.02, LINE_GAP * 0.9]} />
          </mesh>
        </group>
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

/** How bright a glyph's cubes are: dim from afar, full as it is reached, a touch more when open. */
export function glyphShade(gathered: number, on: number, burst: number) {
  return Math.min(1.55, 1 + 0.3 * gathered + 0.15 * on + 0.12 * burst);
}

/**
 * A place's landmark: its glyph in cubes standing on its island. From afar it is dim and
 * slightly scattered; as the tour arrives the cubes draw together, and when the place is
 * opened they lock and brighten a little.
 */
function Glyph({ id, stop }: { id: string; stop: number }) {
  const cubes = useRef<InstancedMesh>(null);
  const cells = useMemo(() => glyphCells(id), [id]);
  const seeds = useMemo(() => {
    const random = seededRandom(stop * 97 + 5);
    return cells.map(() => [random() - 0.5, random(), random() - 0.5] as const);
  }, [cells, stop]);
  const material = useMemo(
    () => new MeshStandardMaterial({ color: '#ffffff', metalness: 0.12, roughness: 0.55 }),
    []
  );
  const geometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.1), []);
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
    const shade = glyphShade(gathered, on, burst);
    for (const [index, [column, row]] of cells.entries()) {
      const seed = seeds[index] as readonly [number, number, number];
      const bob = Math.sin(voyage.time * 1.3 + index) * 0.12 * (1 - on);
      dummy.position.set(
        (column - (GLYPH_COLUMNS - 1) / 2) * GLYPH_CUBE + seed[0] * 9 * loose,
        ISLAND_TOP + 0.1 + (row + 0.5) * GLYPH_CUBE + seed[1] * 7 * loose + bob,
        seed[2] * 12 * loose
      );
      dummy.rotation.set(seed[0] * 3 * loose, seed[1] * 4 * loose, 0);
      dummy.scale.setScalar(GLYPH_CUBE * (0.9 + 0.06 * on + 0.06 * burst));
      dummy.updateMatrix();
      instance.setMatrixAt(index, dummy.matrix);
      tint.set(tealCell(id, column) ? TEAL : GOLD).multiplyScalar(shade);
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
  const top = ISLAND_TOP + (GLYPH_CUBE * 9) / 2;
  const common = { calm: true, id, seed: stop * 13 + 3 };
  return (
    <>
      <FxRings
        calm
        color={GOLD}
        count={3}
        id={id}
        period={2.6}
        position={[0, ISLAND_TOP + 0.05, 0]}
        reach={ISLAND_RADIUS}
      />
      {kind === 'pulse' ? (
        <FxRings
          calm
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
          <FxBeam
            calm
            color={GOLD}
            height={60}
            id={id}
            position={[-4.2, top + 30, 0]}
            radius={0.7}
          />
          <FxBeam
            calm
            color={TEAL}
            height={60}
            id={id}
            position={[4.2, top + 30, 0]}
            radius={0.7}
          />
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
          <FxBeam calm color={GOLD} height={70} id={id} position={[0, top + 35, 0]} radius={1.6} />
          <FxPoints
            {...common}
            colors={[GOLD, '#e9dcc0']}
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
          colors={['#e6dcc6', GOLD]}
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
          colors={['#e0b46e', '#cf7c4c']}
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
          colors={['#d9ae52', '#e8d79a']}
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
          colors={['#cfd99a', TEAL]}
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

/**
 * One place's floating island: the island itself, a soft contact shadow under the glyph,
 * and a few loose rocks hanging beneath. It bobs gently, glyph and all.
 */
function FloatingIsland({
  id,
  materials,
  particles,
  shapes,
  stop,
}: {
  id: string;
  materials: { ground: Material; rock: Material; shade: Material };
  particles: number;
  shapes: SharedShapes;
  stop: number;
}) {
  const float = useRef<Group>(null);
  const geometry = useMemo(() => buildIsland(stop * 31 + 7), [stop]);
  const rocks = useMemo(() => looseRocks(stop), [stop]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const group = float.current;
    if (!group) return;
    group.position.y = Math.sin(voyage.time * 0.55 + stop * 1.7) * 0.35;
    group.rotation.y = Math.sin(voyage.time * 0.21 + stop) * 0.015;
    for (const [index, child] of group.children.entries()) {
      if (child.userData.rock === undefined) continue;
      const lift = Math.sin(voyage.time * 0.8 + index * 2.1 + stop) * 0.5;
      child.position.y = (child.userData.rock as number) + lift;
      child.rotation.y += 0.002;
    }
  });
  return (
    <group ref={float}>
      <mesh geometry={geometry} material={materials.ground} receiveShadow />
      <mesh
        geometry={shapes.plane}
        material={materials.shade}
        position={[0, ISLAND_TOP + 0.03, 0.4]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[GLYPH_COLUMNS * GLYPH_CUBE * 1.3, 7, 1]}
      />
      {rocks.map(([x, y, z, size], index) => (
        <mesh
          geometry={shapes.rock}
          key={`${x}:${z}`}
          material={materials.rock}
          position={[x, y, z]}
          rotation={[index, index * 2, 0]}
          scale={size}
          userData={{ rock: y }}
        />
      ))}
      <Glyph id={id} stop={stop} />
      <StopFx id={id} particles={particles} stop={stop} />
    </group>
  );
}

/** Geometry the islands share: the contact shadow's plane and a loose rock. */
interface SharedShapes {
  plane: BufferGeometry;
  rock: BufferGeometry;
}

/** Every place's landmark beside the file, turned a little toward the approaching camera. */
export function Landmarks({ particles }: { particles: number }) {
  const shared = useMemo(() => {
    const shadow = dotTexture();
    return {
      materials: {
        ground: new MeshStandardMaterial({
          flatShading: true,
          metalness: 0,
          roughness: 0.92,
          vertexColors: true,
        }),
        rock: new MeshStandardMaterial({
          color: '#5d6374',
          flatShading: true,
          metalness: 0,
          roughness: 0.9,
        }),
        shade: new MeshBasicMaterial({
          color: '#000000',
          depthWrite: false,
          map: shadow,
          opacity: 0.5,
          transparent: true,
        }),
      },
      geometry: {
        plane: new BoxGeometry(1, 1, 0.001),
        rock: new RoundedBoxGeometry(1, 1, 1, 1, 0.25),
      },
      texture: shadow,
    };
  }, []);
  useEffect(
    () => () => {
      for (const material of Object.values(shared.materials)) material.dispose();
      shared.geometry.plane.dispose();
      shared.geometry.rock.dispose();
      shared.texture.dispose();
    },
    [shared]
  );
  return (
    <group>
      {TOUR.map((id, index) => {
        const stop = index + 1;
        const [x, y, z] = stopBase(stop);
        return (
          <group key={id} position={[x, y, z]} rotation={[0, 0.5, 0]}>
            <FloatingIsland
              id={id}
              materials={shared.materials}
              particles={particles}
              shapes={shared.geometry}
              stop={stop}
            />
          </group>
        );
      })}
    </group>
  );
}
