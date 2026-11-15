'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  CustomBlending,
  CylinderGeometry,
  FogExp2,
  GreaterDepth,
  type Group,
  InstancedBufferAttribute,
  type InstancedMesh,
  type Material,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshStandardMaterial,
  Object3D,
  OneMinusSrcAlphaFactor,
  RGBADepthPacking,
  SrcAlphaFactor,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { dotTexture } from '../scene/heartbeats';
import { dampFactor } from '../time-keyframes';
import { timeMotion } from '../time-store';
import { fxLevel } from '../voyage/director';
import { FxPoints, FxRings } from '../voyage/place-fx';
import { fxBurst, placeFx, voyage } from '../voyage/state';
import { TOUR } from '../voyage/world-places';

import { chartBars } from './charts';
import { demoMinute, ROOM } from './desk';
import {
  BASE_DEPTH,
  CHART_HEIGHT,
  cursorAt,
  deskY,
  ISLAND_LIFT,
  ISLAND_TOP,
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
import { IslandHeart } from './hearts';
import { buildIsland, ISLAND_RADIUS } from './island';
import { registerPick } from './pick';
import { play, showTip, towerText } from './play';
import { SPEAKERS } from './story';

/**
 * The editor world's scene: the file as a model on a desk — steps of a base with clay token
 * bars on top — the visitor's gold cursor and the AI's teal one, and a bar chart on a
 * floating island for every place. Gold is the human, sea-teal is the AI, as everywhere else
 * on the site.
 *
 * Owner direction 2026-11-15: a miniature in evening lamplight; sharp and calm, never neon.
 * Nothing here is additive light; shapes read through the lamp's light and shadows.
 */

/** Muted, solid versions of the site's gold (human) and sea-teal (AI). */
export const GOLD = '#d6a35f';
export const TEAL = '#5ba89f';

const TOKEN_COLOURS: Record<TokenKind, string> = {
  keyword: '#d9a65f',
  name: '#ddd5c6',
  string: '#7fb6aa',
  number: '#d3907d',
  comment: '#6d7688',
};

/** Lines the AI's cursor types ahead of the visitor's. */
export const AI_LEAD = 6;

/** How high a plate's top sits above its line's height, and a token's centre above that. */
const PLATE_TOP = 0.2;
const TOKEN_LIFT = 0.42;

const dummy = new Object3D();

/* ---------- direction: clock and effects ---------- */

/**
 * Runs after the camera rig: advances the scene clock, the open place's effect and how much
 * of the file has been typed. The room's evening never changes; its lights are in desk.tsx.
 */
export function EditorDirector() {
  const { gl, scene } = useThree();
  const opened = useRef('');
  const fog = useMemo(() => new FogExp2(ROOM, 0.0028), []);
  const chart = useRef(0);
  const day = useRef(play.day);
  const rewinding = useRef(false);
  useEffect(() => {
    const before = scene.background;
    scene.background = new Color(ROOM);
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
    // A new day (from the end card) starts the file over, untyped. Nothing is typed (or
    // collected) again while the camera glides back to the start.
    if (day.current !== play.day) {
      day.current = play.day;
      voyage.reached = 0;
      rewinding.current = true;
    }
    if (rewinding.current && timeMotion.tour < 0.05) rewinding.current = false;
    if (!rewinding.current) voyage.reached = Math.max(voyage.reached, timeMotion.tour);
    // The demo day's clock moves with the cursor: the readout and the ring clock agree.
    timeMotion.hand = demoMinute(timeMotion.tour, TOUR.length);

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

    // A model on a desk has no weather (owner 2026-11-15): the sky stays clear.
    voyage.mist = 0;
    voyage.rain = 0;
    voyage.aurora = 0;
    voyage.meteors = 0;

    // From the whole-file view the haze would hide the far end: clear it.
    chart.current += ((timeMotion.chart ? 1 : 0) - chart.current) * dampFactor(delta, 2);
    fog.density = 0.0028 * (1 - 0.9 * chart.current);
    gl.toneMappingExposure = 1.12;
  }, -0.5);
  return null;
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

/** The typing animation, patched into the tokens' lit material and its shadow. */
const RISE_GLSL = /* glsl */ `
float written;
float typed = typedAmount(written);
float pop = typed + sin(typed * 3.14159) * 0.3;
transformed.y = (transformed.y + 0.5) * mix(0.14, 1.0, pop) - 0.5;
vTyped = typed;
vFresh = typed * (1.0 - smoothstep(1.0, 9.0, written));
`;

/**
 * The tokens' clay: a matte, lit material, so the lamp and its shadows reach the code. The
 * typing is patched in: a token ahead of the cursor lies low and dim, and rises as it is
 * typed. `depth` makes the matching shadow material.
 */
function tokenMaterial(typed: { value: number }, depth = false) {
  const material = depth
    ? new MeshDepthMaterial({ depthPacking: RGBADepthPacking })
    : new MeshStandardMaterial({ metalness: 0, roughness: 0.6 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTyped = typed;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\n${TYPED_GLSL}\nvarying float vTyped;\nvarying float vFresh;`
      )
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${RISE_GLSL}`);
    if (depth) return;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vTyped;\nvarying float vFresh;'
      )
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.32, 1.0, vTyped) * (1.0 + 0.12 * vFresh);'
      );
  };
  material.customProgramCacheKey = () => (depth ? 'editor-token-depth' : 'editor-token');
  return material;
}

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

/** Every token's colour, in instance order (filled by `tokenGeometry`). */
const TOKEN_TINTS: Color[] = [];

function tokenGeometry(count: number) {
  TOKEN_TINTS.length = 0;
  // Rounded like clay pieces; the corners stretch with each bar's length, which reads soft.
  const box = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
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
      TOKEN_TINTS.push(colour.clone());
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
  const uniforms = useMemo(() => ({ uTyped: { value: 0 }, uFog: { value: 0.0028 } }), []);
  const materials = useMemo(
    () => ({ clay: tokenMaterial(uniforms.uTyped), depth: tokenMaterial(uniforms.uTyped, true) }),
    [uniforms]
  );
  useEffect(
    () => () => {
      geometry.dispose();
      materials.clay.dispose();
      materials.depth.dispose();
    },
    [geometry, materials]
  );
  useEffect(() => {
    for (const instance of [mesh.current, mirror.current]) {
      if (instance) placeTokens(instance);
    }
    const instance = mesh.current;
    if (!instance) return;
    for (const [index, tint] of TOKEN_TINTS.entries()) instance.setColorAt(index, tint);
    if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
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
      <instancedMesh
        args={[geometry, materials.clay, count]}
        castShadow
        customDepthMaterial={materials.depth}
        frustumCulled={false}
        receiveShadow
        ref={mesh}
      />
    </>
  );
}

/** The steps: one block of the model's base per line, with a fine edge along its front lip. */
function Steps() {
  const plates = useRef<InstancedMesh>(null);
  const lips = useRef<InstancedMesh>(null);
  const materials = useMemo(
    () => ({
      plate: new MeshStandardMaterial({ color: '#4b4a52', metalness: 0, roughness: 0.78 }),
      lip: new MeshBasicMaterial({ color: '#77757d' }),
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
      // Each step reaches down to the desk: together they are the model's base.
      const top = y + PLATE_TOP;
      const bottom = deskY(z);
      dummy.position.set(centre, (top + bottom) / 2, z);
      dummy.scale.set(width, top - bottom, LINE_GAP * 0.94);
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

/** Where each cursor is this frame: the figurines walk along with them. */
export const caretAt = { human: new Vector3(), ai: new Vector3() };

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
  const roam = useRef(1);
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
    // The AI's cursor works a few lines ahead and wanders a little as it goes; at a place it
    // stands still, so its robot (and the robot's speech bubble) can be read.
    roam.current += ((timeMotion.at ? 0 : 1) - roam.current) * dampFactor(delta, 2.5);
    const wander = ghost ? Math.sin(voyage.time * 0.7) * 1.4 * roam.current : 0;
    const [x, y, z] = cursorAt(lineAtTour(timeMotion.tour) + lead + wander);
    const { current } = at;
    if (!current.ready) Object.assign(current, { ready: true, x, y, z });
    // It glides along the line rather than snapping from token to token.
    const ease = dampFactor(delta, ghost ? 5 : 9);
    current.x += (x - current.x) * ease;
    current.y += (y - current.y) * dampFactor(delta, 12);
    current.z += (z - current.z) * dampFactor(delta, 14);
    group.position.set(current.x, current.y, current.z);
    caretAt[ghost ? 'ai' : 'human'].copy(group.position);
    const blink = caretBlink(voyage.time + (ghost ? 0.4 : 0));
    materials.solid.opacity = (ghost ? 0.85 : 1) * (0.55 + 0.45 * blink);
    // The current line lights up under the visitor's own cursor.
    strip.current?.position.set(3 - current.x, PLATE_TOP + 0.02, 0);
  });
  return (
    <group ref={caret}>
      <mesh castShadow material={materials.solid} position={[0, 2.05, 0]}>
        <boxGeometry args={[0.32, 3.3, 0.32]} />
      </mesh>
      <mesh castShadow material={materials.solid} position={[0.62, 3.95, 0]}>
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

/** How built up a chart is as the tour nears its stop: 0 far away, 1 arrived. */
export function chartGrowth(tour: number, stop: number) {
  return Math.min(1, Math.max(0, 1 - Math.abs(tour - stop) * 1.4) * 1.25);
}

/** Ease-out with a small overshoot, for a tower rising into place. */
function rise(t: number) {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 + 2.2 * (clamped - 1) ** 3 + 1.2 * (clamped - 1) ** 2;
}

/** A tapped tower's springy bounce `age` seconds after the tap: up, then settling. */
export function tapBounce(age: number) {
  if (age < 0 || age > 1.2) return 0;
  return 0.22 * Math.sin(age * 11) * Math.exp(-age * 3.2);
}

/** The page's language, for text the scene shows in the page. */
export function pageLocale(): 'en' | 'th' {
  const site =
    typeof document === 'undefined' ? null : document.querySelector('.wakaclock-marketing');
  return site?.getAttribute('lang') === 'th' ? 'th' : 'en';
}

/**
 * A place's landmark: its bar chart as a model town on the island. From afar the towers are
 * low stubs; as the tour arrives they rise one after another into the chart, and when the
 * place is opened they give a small bounce.
 */
function ChartTowers({ id, stop }: { id: string; stop: number }) {
  const towers = useRef<InstancedMesh>(null);
  const bars = useMemo(() => chartBars(id), [id]);
  const material = useMemo(
    () => new MeshStandardMaterial({ color: '#ffffff', metalness: 0.05, roughness: 0.58 }),
    []
  );
  const geometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.14), []);
  const tints = useMemo(() => ({ human: new Color(GOLD), ai: new Color(TEAL) }), []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );
  /** When each tower was last tapped (scene seconds), for its bounce. */
  const tapped = useRef(new Map<number, number>());
  useEffect(() => {
    const instance = towers.current;
    if (!instance) return;
    for (const index of bars.keys()) {
      instance.setColorAt(index * 2, tints.human);
      instance.setColorAt(index * 2 + 1, tints.ai);
    }
    if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
    // Tap a tower: it bounces and says how much time it stands for (demo).
    return registerPick(instance, (hit, event) => {
      const index = Math.floor((hit.instanceId ?? 0) / 2);
      const bar = bars[index];
      if (!bar) return;
      tapped.current.set(index, voyage.time);
      const locale = pageLocale();
      showTip(
        towerText(bar.human, bar.ai, { you: SPEAKERS.dev[locale], ai: SPEAKERS.bot[locale] }),
        event.clientX,
        event.clientY
      );
    });
  }, [bars, tints]);
  useFrame(() => {
    const instance = towers.current;
    if (!instance) return;
    const { age, on } = placeFx(id);
    const grown = Math.max(chartGrowth(timeMotion.tour, stop), on);
    const bounce = 1 + 0.06 * fxBurst(age, 2.2) * Math.sin(age * 9);
    for (const [index, bar] of bars.entries()) {
      // Left to right, each tower a beat after the one before.
      const own = rise(grown * 1.6 - (index / Math.max(1, bars.length)) * 0.6);
      const since = tapped.current.get(index);
      const poke = since === undefined ? 0 : tapBounce(voyage.time - since);
      const k = (0.06 + 0.94 * own) * bounce * (1 + poke);
      const human = Math.max(0.02, bar.human * k);
      const ai = bar.ai * k;
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(bar.x, ISLAND_TOP + human / 2, bar.z);
      dummy.scale.set(bar.width, human, bar.depth);
      dummy.updateMatrix();
      instance.setMatrixAt(index * 2, dummy.matrix);
      dummy.position.set(bar.x, ISLAND_TOP + human + ai / 2, bar.z);
      dummy.scale.set(bar.width * 0.98, Math.max(0.0001, ai), bar.depth * 0.98);
      dummy.updateMatrix();
      instance.setMatrixAt(index * 2 + 1, dummy.matrix);
    }
    instance.instanceMatrix.needsUpdate = true;
    // The towers change height: let the next tap recompute their bounds.
    instance.boundingSphere = null;
  });
  return (
    <instancedMesh
      args={[geometry, material, bars.length * 2]}
      castShadow
      frustumCulled={false}
      receiveShadow
      ref={towers}
    />
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
  const top = ISLAND_TOP + CHART_HEIGHT * 0.6;
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
      ) : null}
      {kind === 'beam' ? (
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
 * One place's floating island, held over the desk on a brass rod like a model's: the island,
 * a soft contact shadow under the chart, and the chart itself. It bobs very slightly.
 */
function FloatingIsland({
  id,
  materials,
  particles,
  shapes,
  stop,
}: {
  id: string;
  materials: { brass: Material; ground: Material; shade: Material };
  particles: number;
  shapes: SharedShapes;
  stop: number;
}) {
  const float = useRef<Group>(null);
  const geometry = useMemo(() => buildIsland(stop * 31 + 7), [stop]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const group = float.current;
    if (!group) return;
    group.position.y = ISLAND_LIFT + Math.sin(voyage.time * 0.55 + stop * 1.7) * 0.18;
  });
  const rod = ISLAND_LIFT - 4 + BASE_DEPTH;
  return (
    <>
      <mesh
        castShadow
        geometry={shapes.rod}
        material={materials.brass}
        position={[0, ISLAND_LIFT - 4 - rod / 2, 0]}
        scale={[1, rod, 1]}
      />
      <mesh
        castShadow
        geometry={shapes.foot}
        material={materials.brass}
        position={[0, -BASE_DEPTH + 0.2, 0]}
        receiveShadow
      />
      <group ref={float}>
        <mesh castShadow geometry={geometry} material={materials.ground} receiveShadow />
        <mesh
          geometry={shapes.plane}
          material={materials.shade}
          position={[0, ISLAND_TOP + 0.03, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[19, 12, 1]}
        />
        <ChartTowers id={id} stop={stop} />
        <IslandHeart stop={stop} />
        <StopFx id={id} particles={particles} stop={stop} />
      </group>
    </>
  );
}

/** Geometry the islands share: the contact shadow's plane, the rod and its foot. */
interface SharedShapes {
  foot: BufferGeometry;
  plane: BufferGeometry;
  rod: BufferGeometry;
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
        brass: new MeshStandardMaterial({ color: '#b08a55', metalness: 0.7, roughness: 0.35 }),
        shade: new MeshBasicMaterial({
          color: '#000000',
          depthWrite: false,
          map: shadow,
          opacity: 0.35,
          transparent: true,
        }),
      },
      geometry: {
        foot: new CylinderGeometry(2.2, 2.6, 0.4, 32),
        plane: new BoxGeometry(1, 1, 0.001),
        rod: new CylinderGeometry(0.32, 0.32, 1, 16),
      },
      texture: shadow,
    };
  }, []);
  useEffect(
    () => () => {
      for (const material of Object.values(shared.materials)) material.dispose();
      for (const shape of Object.values(shared.geometry)) shape.dispose();
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
