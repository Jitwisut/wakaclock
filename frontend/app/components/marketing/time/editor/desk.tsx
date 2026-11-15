'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import {
  type AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  type DirectionalLight,
  type Group,
  type HemisphereLight,
  type Mesh,
  MeshStandardMaterial,
  Object3D,
  type Points,
  type PointsMaterial,
  RepeatWrapping,
  type SpotLight,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { dotTexture } from '../scene/heartbeats';
import { seededRandom } from '../time-data';
import { dampFactor } from '../time-keyframes';
import { timeMotion } from '../time-store';
import { voyage } from '../voyage/state';

import { DEMO_HOURS } from './charts';
import { deskY, LINE_GAP, STEP_DROP } from './file-plan';
import { registerPick } from './pick';
import { dayLight, play } from './play';

/**
 * The desk the model stands on, the lamp that lights it and the room around it (owner
 * decision 2026-11-15: a miniature on a desk, in the evening). Also the two props that say
 * what the product is: a 24-hour ring clock and a small monitor at the head of the file.
 */

export const ROOM = '#14100d';
const GOLD = '#d6a35f';
const TEAL = '#5ba89f';
const IDLE = '#4a5163';

/* ---------- the desk ---------- */

/** A warm wood grain drawn once on a canvas. */
function woodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#6e4d35';
    context.fillRect(0, 0, 512, 512);
    const random = seededRandom(404);
    for (let line = 0; line < 140; line += 1) {
      const y = random() * 512;
      const light = random() < 0.5;
      context.strokeStyle = light ? 'rgba(138, 100, 70, 0.18)' : 'rgba(52, 34, 22, 0.18)';
      context.lineWidth = 0.6 + random() * 2.4;
      context.beginPath();
      context.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) {
        context.lineTo(x, y + Math.sin(x * 0.012 + line) * (2 + random() * 3));
      }
      context.stroke();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(6, 14);
  texture.anisotropy = 8;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** The desk: one wide plane under the model, tilted with the file's gentle slope. */
export function Desk() {
  const material = useMemo(
    () => new MeshStandardMaterial({ map: woodTexture(), metalness: 0, roughness: 0.62 }),
    []
  );
  useEffect(
    () => () => {
      material.map?.dispose();
      material.dispose();
    },
    [material]
  );
  // Centred 300 m down the file, on the slope: BASE_DEPTH under every line.
  const tilt = Math.atan(STEP_DROP / LINE_GAP);
  return (
    <mesh
      material={material}
      position={[0, deskY(-300), -300]}
      receiveShadow
      rotation={[-Math.PI / 2 - tilt, 0, 0]}
    >
      <planeGeometry args={[1400, 1800]} />
    </mesh>
  );
}

/* ---------- light ---------- */

const ahead = new Vector3();

/**
 * The desk lamp: a warm spot that follows what the camera is looking at, so wherever the
 * tour goes the subject stands in a pool of lamplight with crisp shadows. The rest of the
 * model falls off into the evening room.
 */
export function Lamp({ shadows }: { shadows: boolean }) {
  const lamp = useRef<SpotLight>(null);
  const target = useMemo(() => new Object3D(), []);
  useEffect(() => {
    if (lamp.current) lamp.current.target = target;
  }, [target]);
  useFrame(({ camera }) => {
    const light = lamp.current;
    if (!light) return;
    camera.getWorldDirection(ahead);
    const reach = timeMotion.chart ? 300 : 52;
    target.position.copy(camera.position).addScaledVector(ahead, reach);
    target.updateMatrixWorld();
    light.position.set(target.position.x - 38, target.position.y + 62, target.position.z + 26);
    light.intensity = dayNow().lamp;
  });
  return (
    <>
      <primitive object={target} />
      <spotLight
        angle={0.62}
        castShadow={shadows}
        color="#ffe8cc"
        decay={0}
        intensity={4.6}
        penumbra={0.75}
        ref={lamp}
        shadow-bias={-0.0004}
        shadow-camera-far={260}
        shadow-camera-near={20}
        shadow-mapSize-height={2048}
        shadow-mapSize-width={2048}
        shadow-normalBias={0.04}
      />
    </>
  );
}

/** The day so far, eased: the room's light follows the tour (owner decision 2026-11-15). */
const day = { progress: 0, ended: 0 };

/** This frame's light of the day. */
function dayNow() {
  const light = dayLight(day.progress);
  const lampOff = 1 - 0.75 * day.ended;
  return { ...light, lamp: light.lamp * lampOff, room: light.room * (1 - 0.3 * day.ended) };
}

const sunColour = new Color('#ffcf9a');
const nightColour = new Color('#7f95c8');
const roomDay = new Color('#2c231b');
const roomNight = new Color('#100d0b');

/**
 * The room's other light: a fill, and the window. The afternoon is bright through the
 * window; by evening the sun is low and golden and the lamp comes on; at night only the lamp
 * is left. The room itself (background and haze) darkens with it.
 */
export function RoomLight({ stops }: { stops: number }) {
  const ambient = useRef<AmbientLight>(null);
  const sky = useRef<HemisphereLight>(null);
  const key = useRef<DirectionalLight>(null);
  const pane = useRef<DirectionalLight>(null);
  useFrame(({ scene }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    day.progress += (timeMotion.tour / stops - day.progress) * dampFactor(delta, 1.2);
    day.ended += ((play.ended ? 1 : 0) - day.ended) * dampFactor(delta, 1.6);
    const light = dayNow();
    if (ambient.current) ambient.current.intensity = 0.42 * light.room;
    if (sky.current) sky.current.intensity = 0.95 * light.room;
    if (key.current) key.current.intensity = 1.05 * light.room;
    if (pane.current) {
      pane.current.intensity = light.window;
      pane.current.color.copy(nightColour).lerp(sunColour, light.warmth);
    }
    const room = roomNight.clone().lerp(roomDay, light.room - 0.45);
    if (scene.background instanceof Color) scene.background.copy(room);
    if (scene.fog) scene.fog.color.copy(room);
  });
  return (
    <>
      <ambientLight color="#c4b4a2" intensity={0.42} ref={ambient} />
      <hemisphereLight args={['#c0c8e0', '#6a5440', 0.95]} ref={sky} />
      <directionalLight color="#fff1de" intensity={1.05} position={[-45, 70, 40]} ref={key} />
      <directionalLight color="#ffcf9a" intensity={1.2} position={[70, 40, -60]} ref={pane} />
    </>
  );
}

/** Lights of the room far beyond the desk, soft and out of focus. They travel with the camera. */
export function RoomGlow({ count = 46 }: { count?: number }) {
  const glow = useRef<Points>(null);
  const map = useMemo(() => dotTexture(), []);
  const geometry = useMemo(() => {
    const random = seededRandom(73);
    const position = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const around = random() * Math.PI * 2;
      const up = random() * 0.32 - 0.04;
      position.set(
        [Math.cos(around) * 1300, Math.sin(up) * 1300, Math.sin(around) * 1300],
        index * 3
      );
    }
    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(position, 3));
    return buffer;
  }, [count]);
  useEffect(
    () => () => {
      geometry.dispose();
      map.dispose();
    },
    [geometry, map]
  );
  const material = useRef<PointsMaterial>(null);
  useFrame(({ camera }) => {
    glow.current?.position.copy(camera.position);
    // The room's lights come on as the evening falls.
    if (material.current) material.current.opacity = dayNow().glow;
  });
  return (
    <points frustumCulled={false} geometry={geometry} ref={glow} renderOrder={-9}>
      <pointsMaterial
        color="#e0b27e"
        depthWrite={false}
        fog={false}
        map={map}
        opacity={0.22}
        ref={material}
        size={26}
        sizeAttenuation={false}
        transparent
      />
    </points>
  );
}

/* ---------- the ring clock ---------- */

/** Where the hero's props stand on the desk: right of the copy, beside the head of the file. */
export const CLOCK_AT: [number, number, number] = [54, deskY(-34), -34];
export const MONITOR_AT: [number, number, number] = [45, deskY(8), 8];

/** The demo day's hours, each with its own number for a stable key. */
const HOURS = DEMO_HOURS.map(([human, ai], hour) => ({ ai, hour, human }));

/** The demo day's minute that the clock shows for a tour position: 09:00 → 22:00, the end of
 * its last session, so the readout's coded time ends on the end card's total. */
export function demoMinute(tour: number, stops: number) {
  return 9 * 60 + Math.min(1, Math.max(0, tour / stops)) * 13 * 60;
}

/**
 * The product's day ring as a model: a dial on a plinth with the 24 hours round it, each
 * hour's coding a tower (gold human, teal AI on top), and a hand that moves through the
 * demo day as the cursor types down the file.
 */
export function RingClock({ stops }: { stops: number }) {
  const hand = useRef<Group>(null);
  const materials = useMemo(
    () => ({
      dial: new MeshStandardMaterial({ color: '#2b3142', metalness: 0.1, roughness: 0.7 }),
      rim: new MeshStandardMaterial({ color: '#c9b79a', metalness: 0.35, roughness: 0.45 }),
      human: new MeshStandardMaterial({ color: GOLD, roughness: 0.6 }),
      ai: new MeshStandardMaterial({ color: TEAL, roughness: 0.6 }),
      idle: new MeshStandardMaterial({ color: IDLE, roughness: 0.7 }),
      hand: new MeshStandardMaterial({ color: '#efe6d6', roughness: 0.5 }),
    }),
    []
  );
  const tower = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.12), []);
  useEffect(
    () => () => {
      tower.dispose();
      for (const material of Object.values(materials)) material.dispose();
    },
    [materials, tower]
  );
  /** When the clock was last tapped: the hand runs once round the dial. */
  const spun = useRef(-10);
  const dial = useRef<Mesh>(null);
  useEffect(() => {
    if (!dial.current) return;
    return registerPick(dial.current, () => {
      spun.current = voyage.time;
    });
  }, []);
  useFrame(() => {
    if (!hand.current) return;
    const minute = demoMinute(timeMotion.tour, stops);
    const spin = Math.min(1, (voyage.time - spun.current) / 1.4);
    const extra = spin < 1 ? (1 - (1 - spin) ** 3) * Math.PI * 2 : 0;
    hand.current.rotation.y = -(minute / (24 * 60)) * Math.PI * 2 - extra;
  });
  const radius = 9;
  return (
    <group position={CLOCK_AT} rotation={[0, -0.45, 0]} scale={1.3}>
      {/* The plinth and the dial. */}
      <mesh castShadow material={materials.dial} position={[0, 0.6, 0]} receiveShadow ref={dial}>
        <cylinderGeometry args={[radius + 2.2, radius + 2.6, 1.2, 64]} />
      </mesh>
      <mesh
        castShadow
        material={materials.rim}
        position={[0, 1.25, 0]}
        receiveShadow
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[radius + 2.2, 0.22, 10, 96]} />
      </mesh>
      {/* Hours: a tower per hour, lying round the dial like the dashboard's ring. */}
      {HOURS.map(({ ai, hour, human }) => {
        const angle = (hour / 24) * Math.PI * 2;
        const x = Math.sin(angle) * radius;
        const z = -Math.cos(angle) * radius;
        const scale = 0.55;
        return (
          <group key={hour} position={[x, 1.2, z]} rotation={[0, -angle, 0]}>
            <mesh
              castShadow
              geometry={tower}
              material={human > 0.5 ? materials.human : materials.idle}
              position={[0, (human * scale) / 2, 0]}
              receiveShadow
              scale={[1.5, Math.max(0.2, human * scale), 1.1]}
            />
            {ai > 0 ? (
              <mesh
                castShadow
                geometry={tower}
                material={materials.ai}
                position={[0, human * scale + (ai * scale) / 2, 0]}
                receiveShadow
                scale={[1.5, ai * scale, 1.1]}
              />
            ) : null}
            {hour % 6 === 0 ? (
              <mesh material={materials.rim} position={[0, 0.1, -2.6]}>
                <boxGeometry args={[0.35, 0.2, 1.2]} />
              </mesh>
            ) : null}
          </group>
        );
      })}
      {/* The hand: from the hub to the hour it is. */}
      <group position={[0, 1.45, 0]} ref={hand}>
        <mesh castShadow material={materials.hand} position={[0, 0, -3.6]}>
          <boxGeometry args={[0.4, 0.3, 7.2]} />
        </mesh>
        <mesh castShadow material={materials.hand}>
          <cylinderGeometry args={[0.8, 0.8, 0.5, 24]} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------- the monitor ---------- */

/** The editor on the little screen: gutter, coloured lines, a gold caret. Drawn once. */
function screenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#10141d';
    context.fillRect(0, 0, 512, 320);
    context.fillStyle = '#1a2030';
    context.fillRect(0, 0, 512, 22);
    context.fillStyle = '#2a3245';
    context.fillRect(0, 22, 40, 298);
    const colours = ['#cf9f60', '#c4bdb0', '#76ada2', '#c98c7c', '#56627a'];
    const random = seededRandom(91);
    for (let line = 0; line < 14; line += 1) {
      const y = 34 + line * 20;
      context.fillStyle = '#4a5574';
      context.fillRect(14, y + 4, line > 8 ? 16 : 9, 6);
      let x = 54 + (line % 4 === 0 ? 0 : 18 * (1 + (line % 3)));
      const words = 2 + Math.floor(random() * 4);
      for (let word = 0; word < words; word += 1) {
        const width = 18 + random() * 60;
        context.fillStyle = colours[Math.floor(random() * colours.length)] ?? '#c4bdb0';
        context.fillRect(x, y, width, 12);
        x += width + 9;
      }
      if (line === 9) {
        context.fillStyle = GOLD;
        context.fillRect(x + 2, y - 3, 4, 18);
      }
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapT = RepeatWrapping;
  return texture;
}

/** A small monitor and keyboard at the head of the file: where the code comes from. */
export function Monitor() {
  const materials = useMemo(() => {
    const screen = screenTexture();
    return {
      body: new MeshStandardMaterial({ color: '#2a2d36', metalness: 0.35, roughness: 0.5 }),
      screen: new MeshStandardMaterial({
        color: '#000000',
        emissive: '#ffffff',
        emissiveIntensity: 0.85,
        emissiveMap: screen,
        roughness: 0.3,
      }),
      keys: new MeshStandardMaterial({ color: '#d9d2c4', roughness: 0.7 }),
    };
  }, []);
  const key = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.15), []);
  useEffect(
    () => () => {
      materials.screen.emissiveMap?.dispose();
      for (const material of Object.values(materials)) material.dispose();
      key.dispose();
    },
    [key, materials]
  );
  const keys = useMemo(() => {
    const list: [number, number][] = [];
    for (let rowIndex = 0; rowIndex < 4; rowIndex += 1) {
      for (let column = 0; column < 12; column += 1) list.push([column, rowIndex]);
    }
    return list;
  }, []);
  /** When the monitor was last tapped: a burst of typing, keys going down, lines scrolling. */
  const typed = useRef(-10);
  const screen = useRef<Mesh>(null);
  const board = useRef<Mesh>(null);
  const caps = useRef<Group>(null);
  useEffect(() => {
    const undo = [screen.current, board.current]
      .filter((object): object is Mesh => object !== null)
      .map((object) =>
        registerPick(object, () => {
          typed.current = voyage.time;
        })
      );
    return () => {
      for (const release of undo) release();
    };
  }, []);
  useFrame(() => {
    // The screen breathes very slightly, like a real one; never a glow.
    materials.screen.emissiveIntensity = 0.8 + 0.04 * Math.sin(voyage.time * 1.7);
    const burst = voyage.time - typed.current;
    const typing = burst >= 0 && burst < 1.6;
    const map = materials.screen.emissiveMap;
    if (map && typing) map.offset.y = (map.offset.y - 0.004) % 1;
    for (const [index, cap] of (caps.current?.children ?? []).entries()) {
      // Keys go down one after another, in a pseudo-random order, while it types.
      const beat = (burst * 14 + index * 7.3) % 6;
      cap.position.y = typing && beat < 1 ? 0.32 : 0.5;
    }
  });
  return (
    <group position={MONITOR_AT} rotation={[0, -0.75, 0]}>
      {/* Stand. */}
      <mesh castShadow material={materials.body} position={[0, 0.25, 0]} receiveShadow>
        <boxGeometry args={[6, 0.5, 4]} />
      </mesh>
      <mesh castShadow material={materials.body} position={[0, 3.2, -0.6]}>
        <boxGeometry args={[1.2, 5.6, 0.8]} />
      </mesh>
      {/* Bezel and screen. */}
      <mesh castShadow material={materials.body} position={[0, 8.6, 0]} receiveShadow>
        <boxGeometry args={[17, 10.8, 0.9]} />
      </mesh>
      <mesh material={materials.screen} position={[0, 8.75, 0.46]} ref={screen}>
        <planeGeometry args={[16, 10]} />
      </mesh>
      {/* Keyboard. */}
      <group position={[0, 0.3, 7.5]} rotation={[-0.06, 0, 0]}>
        <mesh castShadow material={materials.body} receiveShadow ref={board}>
          <boxGeometry args={[15, 0.6, 5.4]} />
        </mesh>
        <group ref={caps}>
          {keys.map(([column, rowIndex]) => (
            <mesh
              castShadow
              geometry={key}
              key={`${column}:${rowIndex}`}
              material={materials.keys}
              position={[-6.05 + column * 1.1, 0.5, -1.65 + rowIndex * 1.1]}
              scale={[0.95, 0.45, 0.95]}
            />
          ))}
        </group>
      </group>
    </group>
  );
}
