'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  ExtrudeGeometry,
  type Group,
  type InstancedMesh,
  LatheGeometry,
  type Material,
  type Mesh,
  type MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Shape,
  TorusGeometry,
  Vector2,
} from 'three';

import { dotTexture } from '../scene/heartbeats';
import { type ActivitySlice, MINUTES_PER_DAY, seededRandom, sliceRuns } from '../time-data';
import { timeMotion } from '../time-store';

import { KIND_LIGHT } from './log-props';
import { fxBurst, placeFx, voyage } from './state';
import { type Building, ISLAND_SCALE, type Place, PLACES } from './world-places';

/** Height of an island's plateau, where buildings stand. */
export const PLATEAU = 3.6;

const dummy = new Object3D();
const SAND_WET = new Color('#5e4a35');
const SAND = new Color('#d9bd8f');
const ROCK = new Color('#7a6352');
const GRASS = new Color('#5f7a43');
const scratch = new Color();

/**
 * An island: a turned profile (shelf, beach, rocky slope, grassy plateau) with an irregular
 * coastline, coloured by height. Deterministic per seed.
 */
export function islandGeometry(radius: number, seed: number) {
  // The shelf drops away steeply below the beach, so passing troughs never bare it.
  const profile: [number, number][] = [
    [0.001, -9],
    [1.16, -9],
    [1.1, -3.2],
    [1.05, -0.9],
    [1, 0.35],
    [0.92, 0.7],
    [0.8, 1.6],
    [0.66, 2.9],
    [0.58, 3.45],
    [0.45, PLATEAU],
    [0.001, PLATEAU + 0.15],
  ];
  const geometry = new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r * radius, y)),
    64
  );
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const random = seededRandom(seed);
  const phase = [random() * 6.28, random() * 6.28, random() * 6.28];
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const angle = Math.atan2(z, x);
    const wobble =
      1 +
      0.13 * Math.sin(3 * angle + (phase[0] as number)) +
      0.07 * Math.sin(7 * angle + (phase[1] as number)) +
      0.035 * Math.sin(13 * angle + (phase[2] as number));
    position.setX(index, x * wobble);
    position.setZ(index, z * wobble);
    // Rocky slope: a little vertical breakup.
    if (y > 0.6 && y < PLATEAU - 0.1) {
      position.setY(index, y + 0.25 * Math.sin(angle * 9 + y * 2 + (phase[0] as number)));
    }
    if (y < 0.2) scratch.copy(SAND_WET);
    else if (y < 0.8) scratch.copy(SAND);
    else if (y < 3.2) scratch.copy(ROCK).lerp(SAND, Math.max(0, 1 - (y - 0.8) * 1.4) * 0.5);
    else scratch.copy(GRASS);
    colors.set([scratch.r, scratch.g, scratch.b], index * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function useMaterials() {
  const materials = useMemo(() => {
    const make = (color: string, roughness = 0.8, metalness = 0) =>
      new MeshStandardMaterial({ color, roughness, metalness });
    return {
      island: new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
      plaster: make('#e9dcc6', 0.85),
      warmPlaster: make('#d7ad84', 0.85),
      roseplaster: make('#c98f73', 0.85),
      stone: make('#b29c80', 0.9),
      darkStone: make('#6f6253', 0.9),
      roof: make('#9c4f36', 0.75),
      copper: make('#5f927f', 0.55, 0.45),
      timber: make('#4d3626', 0.85),
      darkTimber: make('#2c1f16', 0.85),
      redBand: make('#a63a2b', 0.7),
      iron: make('#26262a', 0.5, 0.7),
      pine: make('#2f4a2f', 0.9),
      trunk: make('#4a3324', 0.9),
      canvas: new MeshStandardMaterial({ color: '#e8dcc2', roughness: 0.9, side: DoubleSide }),
      window: new MeshStandardMaterial({
        color: '#2a1606',
        emissive: new Color('#ffb15c'),
        emissiveIntensity: 1,
        roughness: 0.4,
      }),
    };
  }, []);
  useEffect(
    () => () => {
      for (const material of Object.values(materials)) material.dispose();
    },
    [materials]
  );
  return materials;
}

type Materials = ReturnType<typeof useMaterials>;

/** Faces local +Z toward the ship at the origin. */
function facing(place: Place) {
  return Math.atan2(-place.at[0], -place.at[1]);
}

function Glow({
  color,
  fx,
  position,
  size,
  strength = 0.6,
}: {
  color: string;
  /** The place whose opening makes this light flare. */
  fx?: string;
  position: [number, number, number];
  size: number;
  strength?: number;
}) {
  const material = useRef<MeshBasicMaterial>(null);
  const map = useMemo(() => dotTexture(), []);
  useEffect(() => () => map.dispose(), [map]);
  useFrame(() => {
    if (!material.current) return;
    const { age, on } = fx ? placeFx(fx) : REST;
    material.current.opacity =
      strength * (0.35 + 0.65 * voyage.lanterns) * (1 + on * 0.9 + fxBurst(age, 2.5) * 1.6);
  });
  return (
    <sprite position={position} scale={[size, size, 1]}>
      <spriteMaterial
        blending={AdditiveBlending}
        color={color}
        depthWrite={false}
        map={map}
        ref={material as never}
        toneMapped={false}
        transparent
      />
    </sprite>
  );
}

const REST = { age: 99, on: 0 };

/**
 * Dressing that makes an island read as a place from the map: boulders along the shore and
 * lamp posts around the plateau, each with a small light. Scaled by the device's detail level.
 */
function Dressing({
  detail,
  materials,
  radius,
  seed,
}: {
  detail: number;
  materials: Materials;
  radius: number;
  seed: number;
}) {
  const rocks = useRef<InstancedMesh>(null);
  const posts = useRef<InstancedMesh>(null);
  const lamps = useRef<InstancedMesh>(null);
  const rockCount = Math.round(radius * 1.1 * detail);
  const lampCount = Math.round(4 + radius * 0.2 * detail);
  const geometries = useMemo(
    () => ({
      rock: new DodecahedronGeometry(1, 0),
      post: new CylinderGeometry(0.05, 0.07, 1.9, 5),
      lamp: new BoxGeometry(0.26, 0.32, 0.26),
    }),
    []
  );
  const lampMaterial = useMemo(
    () => new MeshStandardMaterial({ color: '#3a2410', emissive: '#ffb45e', roughness: 0.5 }),
    []
  );
  useEffect(
    () => () => {
      for (const geometry of Object.values(geometries)) geometry.dispose();
      lampMaterial.dispose();
    },
    [geometries, lampMaterial]
  );
  useEffect(() => {
    const random = seededRandom(seed);
    for (let index = 0; index < rockCount; index += 1) {
      const angle = random() * Math.PI * 2;
      const r = radius * (0.78 + random() * 0.26);
      const size = 0.5 + random() * 1.3;
      dummy.position.set(Math.cos(angle) * r, 0.2 + random() * 1.2, Math.sin(angle) * r);
      dummy.rotation.set(random() * 3, random() * 3, random() * 3);
      dummy.scale.set(size, size * (0.55 + random() * 0.5), size * (0.7 + random() * 0.5));
      dummy.updateMatrix();
      rocks.current?.setMatrixAt(index, dummy.matrix);
    }
    for (let index = 0; index < lampCount; index += 1) {
      const angle = (index / lampCount) * Math.PI * 2 + random() * 0.5;
      const r = radius * (0.3 + random() * 0.12);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.position.set(Math.cos(angle) * r, PLATEAU + 0.95, Math.sin(angle) * r);
      dummy.updateMatrix();
      posts.current?.setMatrixAt(index, dummy.matrix);
      dummy.position.y = PLATEAU + 2.02;
      dummy.updateMatrix();
      lamps.current?.setMatrixAt(index, dummy.matrix);
    }
    for (const mesh of [rocks.current, posts.current, lamps.current]) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  }, [lampCount, radius, rockCount, seed]);
  useFrame(() => {
    lampMaterial.emissiveIntensity = 0.8 + voyage.lanterns * 3.2;
  });
  return (
    <>
      {rockCount > 0 ? (
        <instancedMesh
          args={[geometries.rock, materials.darkStone, rockCount]}
          castShadow
          receiveShadow
          ref={rocks}
        />
      ) : null}
      <instancedMesh args={[geometries.post, materials.iron, lampCount]} ref={posts} />
      <instancedMesh args={[geometries.lamp, lampMaterial, lampCount]} ref={lamps} />
    </>
  );
}

function Trees({
  count,
  radius,
  seed,
  materials,
}: {
  count: number;
  materials: Materials;
  radius: number;
  seed: number;
}) {
  const crowns = useRef<InstancedMesh>(null);
  const trunks = useRef<InstancedMesh>(null);
  const geometries = useMemo(
    () => ({ crown: new ConeGeometry(0.9, 3, 7), trunk: new CylinderGeometry(0.12, 0.16, 1.2, 5) }),
    []
  );
  useEffect(
    () => () => {
      geometries.crown.dispose();
      geometries.trunk.dispose();
    },
    [geometries]
  );
  useEffect(() => {
    const random = seededRandom(seed);
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const r = radius * (0.22 + random() * 0.24);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const scale = 0.7 + random() * 0.7;
      dummy.rotation.set(0, random() * 6, 0);
      dummy.scale.setScalar(scale);
      dummy.position.set(x, PLATEAU + 1.2 * scale + 1.5 * scale, z);
      dummy.updateMatrix();
      crowns.current?.setMatrixAt(index, dummy.matrix);
      dummy.position.set(x, PLATEAU + 0.6 * scale, z);
      dummy.updateMatrix();
      trunks.current?.setMatrixAt(index, dummy.matrix);
    }
    if (crowns.current) crowns.current.instanceMatrix.needsUpdate = true;
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true;
  }, [count, radius, seed]);
  return (
    <>
      <instancedMesh args={[geometries.crown, materials.pine, count]} castShadow ref={crowns} />
      <instancedMesh args={[geometries.trunk, materials.trunk, count]} ref={trunks} />
    </>
  );
}

/** A gable roof: a triangular prism `width` across, `depth` long, `rise` high. */
function gable(width: number, depth: number, rise: number) {
  const shape = new Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, rise);
  shape.lineTo(-width / 2, 0);
  const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function House({
  at,
  body,
  materials,
  rotation = 0,
  size,
}: {
  at: [number, number];
  body: Material;
  materials: Materials;
  rotation?: number;
  size: [number, number, number];
}) {
  const [w, h, d] = size;
  const roof = useMemo(() => gable(w + 0.6, d + 0.6, h * 0.55), [d, h, w]);
  useEffect(() => () => roof.dispose(), [roof]);
  return (
    <group position={[at[0], PLATEAU, at[1]]} rotation={[0, rotation, 0]}>
      <mesh castShadow material={body} position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      <mesh castShadow geometry={roof} material={materials.roof} position={[0, h, 0]} />
      <mesh material={materials.window} position={[0, h * 0.5, d / 2 + 0.02]}>
        <boxGeometry args={[w * 0.28, h * 0.3, 0.04]} />
      </mesh>
      <mesh material={materials.darkTimber} position={[w * 0.3, h * 0.3, d / 2 + 0.02]}>
        <boxGeometry args={[w * 0.18, h * 0.6, 0.04]} />
      </mesh>
    </group>
  );
}

/* ---------- landmarks ---------- */

function Lighthouse({ materials }: { materials: Materials }) {
  const beam = useRef<Group>(null);
  const beamMaterial = useRef<MeshBasicMaterial>(null);
  const beamGeometry = useMemo(() => {
    const cone = new ConeGeometry(4, 46, 24, 1, true);
    cone.rotateZ(Math.PI / 2);
    cone.translate(23, 0, 0);
    return cone;
  }, []);
  useEffect(() => () => beamGeometry.dispose(), [beamGeometry]);
  useFrame((_, delta) => {
    // The beam sweeps once every eight seconds — a heartbeat for the whole sea.
    // Opened to read, it races round and burns brighter, then settles to a quicker sweep.
    const { age, on } = placeFx('lighthouse');
    const rush = 1 + on * 1.4 + fxBurst(age, 4) * 9;
    if (beam.current) {
      beam.current.rotation.y += Math.min(delta, 0.1) * ((Math.PI * 2) / 8) * rush;
    }
    if (beamMaterial.current) {
      beamMaterial.current.opacity = (0.05 + 0.2 * voyage.lanterns) * (1 + on * 1.2);
    }
  });
  const top = PLATEAU + 15;
  return (
    <group>
      <mesh castShadow material={materials.plaster} position={[0, PLATEAU + 7.5, 0]}>
        <cylinderGeometry args={[1.45, 2.4, 15, 28]} />
      </mesh>
      {[0.32, 0.64].map((share) => (
        <mesh key={share} material={materials.redBand} position={[0, PLATEAU + 15 * share, 0]}>
          <cylinderGeometry
            args={[2.4 - 0.95 * share + 0.02, 2.4 - 0.95 * share + 0.06, 1.6, 28]}
          />
        </mesh>
      ))}
      <mesh material={materials.darkStone} position={[0, top + 0.15, 0]}>
        <cylinderGeometry args={[2.1, 1.6, 0.4, 28]} />
      </mesh>
      <mesh material={materials.iron} position={[0, top + 0.95, 0]}>
        <torusGeometry args={[2, 0.04, 6, 40]} />
      </mesh>
      <mesh material={materials.window} position={[0, top + 1.4, 0]}>
        <cylinderGeometry args={[1.05, 1.05, 2.2, 16]} />
      </mesh>
      <mesh material={materials.redBand} position={[0, top + 2.6, 0]}>
        <sphereGeometry args={[1.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <group position={[0, top + 1.4, 0]} ref={beam}>
        <mesh geometry={beamGeometry}>
          <meshBasicMaterial
            blending={AdditiveBlending}
            color="#ffd28a"
            depthWrite={false}
            opacity={0.12}
            ref={beamMaterial}
            side={DoubleSide}
            toneMapped={false}
            transparent
          />
        </mesh>
      </group>
      <Glow color="#ffc070" fx="lighthouse" position={[0, top + 1.4, 0]} size={9} strength={0.9} />
      <House at={[3.5, 1.5]} body={materials.plaster} materials={materials} size={[3.2, 2.4, 3]} />
    </group>
  );
}

/** Seconds the clock hand takes to whirl through the day when its place opens. */
const CLOCK_WHIRL = 3.2;

/** A clock tower whose face is a 24-hour dial with today's demo sessions inlaid. */
function ClockTower({ materials, slices }: { materials: Materials; slices: ActivitySlice[] }) {
  const runs = useMemo(() => sliceRuns(slices, 0), [slices]);
  const arcs = useMemo(
    () =>
      runs.map(
        (run) =>
          new TorusGeometry(
            1.75,
            0.09,
            5,
            20,
            ((run.end - run.start) / MINUTES_PER_DAY) * Math.PI * 2
          )
      ),
    [runs]
  );
  const roof = useMemo(() => new ConeGeometry(4.4, 6.5, 4), []);
  useEffect(
    () => () => {
      arcs.forEach((geometry) => geometry.dispose());
      roof.dispose();
    },
    [arcs, roof]
  );
  const hand = useRef<Mesh>(null);
  const arcMaterials = useRef<(MeshBasicMaterial | null)[]>([]);
  useFrame(() => {
    // Opened to read, the hand whirls once through the whole day (easing out onto the real
    // hour) and each session lights as the hand passes it.
    const { age, on } = placeFx('clocktower');
    const whirl = age < CLOCK_WHIRL ? (1 - age / CLOCK_WHIRL) ** 3 : 0;
    const shown = voyage.hand - whirl * MINUTES_PER_DAY;
    const minute = ((shown % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    if (hand.current) hand.current.rotation.z = -((shown / MINUTES_PER_DAY) * Math.PI * 2);
    for (const [index, run] of runs.entries()) {
      const material = arcMaterials.current[index];
      if (material) {
        const passed = whirl > 0 ? run.start < minute : run.start < voyage.hand;
        material.color.copy(KIND_LIGHT[run.kind]).multiplyScalar((passed ? 1.6 : 0.4) * (1 + on));
      }
    }
  });
  const faceY = PLATEAU + 17.5;
  return (
    <group>
      <mesh castShadow material={materials.stone} position={[0, PLATEAU + 7.5, 0]}>
        <boxGeometry args={[6, 15, 6]} />
      </mesh>
      <mesh castShadow material={materials.warmPlaster} position={[0, PLATEAU + 18, 0]}>
        <boxGeometry args={[5.2, 6, 5.2]} />
      </mesh>
      <mesh
        castShadow
        geometry={roof}
        material={materials.roof}
        position={[0, PLATEAU + 24.2, 0]}
        rotation={[0, Math.PI / 4, 0]}
      />
      {/* The dial, on the face toward the sea. */}
      <group position={[0, faceY, 2.62]}>
        <mesh>
          <circleGeometry args={[2.2, 48]} />
          <meshStandardMaterial color="#efe3c8" roughness={0.6} />
        </mesh>
        {Array.from({ length: 24 }, (_, index) => {
          const angle = Math.PI / 2 - (index / 24) * Math.PI * 2;
          return (
            <mesh
              key={index}
              material={materials.darkTimber}
              position={[Math.cos(angle) * 2, Math.sin(angle) * 2, 0.02]}
              rotation={[0, 0, angle]}
            >
              <boxGeometry args={[index % 6 === 0 ? 0.42 : 0.22, 0.06, 0.02]} />
            </mesh>
          );
        })}
        {runs.map((run, index) => (
          <mesh
            geometry={arcs[index]}
            key={`${run.start}:${run.kind}`}
            position={[0, 0, 0.04]}
            rotation={[0, 0, Math.PI / 2 - (run.end / MINUTES_PER_DAY) * Math.PI * 2]}
          >
            <meshBasicMaterial
              ref={(node) => {
                arcMaterials.current[index] = node;
              }}
              toneMapped={false}
            />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.08]} ref={hand}>
          <boxGeometry args={[0.08, 1.7, 0.03]} />
          <meshStandardMaterial color="#1d1712" />
        </mesh>
      </group>
      <House
        at={[-5, 3]}
        body={materials.roseplaster}
        materials={materials}
        rotation={0.4}
        size={[3.4, 2.6, 3]}
      />
    </group>
  );
}

function TwinLights({ materials }: { materials: Materials }) {
  const orbs = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    // Opened to read, the two lights swell and breathe in turn: human, then AI.
    const { age, on } = placeFx('twinlights');
    for (const [index, orb] of orbs.current.entries()) {
      const breath = Math.sin(voyage.time * 2.2 + index * Math.PI) * 0.5 + 0.5;
      orb?.scale.setScalar(1 + on * (0.5 + 0.5 * breath) + fxBurst(age, 2) * 1.2);
    }
  });
  return (
    <group>
      {/* Two beacons flank the keeper's house, gold and teal; a pier runs out toward the ship. */}
      <mesh material={materials.timber} position={[0, 0.9, 13]}>
        <boxGeometry args={[3.2, 0.4, 18]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 5.2, PLATEAU - 0.4, 0.5]}>
          <mesh castShadow material={materials.stone} position={[0, 4.5, 0]}>
            <cylinderGeometry args={[0.7, 1.1, 9, 14]} />
          </mesh>
          <mesh
            position={[0, 9.6, 0]}
            ref={(node) => {
              orbs.current[side < 0 ? 0 : 1] = node;
            }}
          >
            <sphereGeometry args={[0.75, 18, 12]} />
            <meshBasicMaterial color={side < 0 ? '#ffb85c' : '#46d6c8'} toneMapped={false} />
          </mesh>
          <Glow
            color={side < 0 ? '#ffb85c' : '#46d6c8'}
            fx="twinlights"
            position={[0, 9.6, 0]}
            size={8}
            strength={1}
          />
        </group>
      ))}
      <House at={[0, -2]} body={materials.plaster} materials={materials} size={[4.5, 3.2, 3.6]} />
    </group>
  );
}

function Market({ materials }: { materials: Materials }) {
  const homes: {
    at: [number, number];
    body: Material;
    rotation: number;
    size: [number, number, number];
  }[] = [
    { at: [-6, 2], body: materials.warmPlaster, rotation: 0.3, size: [3.6, 3.2, 3.2] },
    { at: [-1.5, 5.5], body: materials.plaster, rotation: -0.1, size: [3.2, 4.2, 3] },
    { at: [3, 4.5], body: materials.roseplaster, rotation: -0.4, size: [3.4, 3.4, 3.4] },
    { at: [6.5, 0.5], body: materials.warmPlaster, rotation: -1, size: [3, 3, 3] },
    { at: [-4, -3.5], body: materials.roseplaster, rotation: 1.2, size: [3.2, 2.8, 3] },
    { at: [2, -4], body: materials.plaster, rotation: 2.4, size: [3.8, 3.6, 3.2] },
    { at: [-8.5, -2], body: materials.plaster, rotation: 1.6, size: [2.8, 2.6, 2.8] },
  ];
  return (
    <group>
      {homes.map((home) => (
        <House key={home.at.join(',')} materials={materials} {...home} />
      ))}
      <Glow
        color="#ffb060"
        fx="market"
        position={[0.4, PLATEAU + 2.4, 1.2]}
        size={9}
        strength={0.5}
      />
      {/* Market awnings in the square. */}
      {[-1.6, 0.4, 2.4].map((x, index) => (
        <group key={x} position={[x, PLATEAU, 0.6]}>
          <mesh material={materials.timber} position={[0, 0.9, 0]}>
            <boxGeometry args={[1.6, 0.9, 1]} />
          </mesh>
          <mesh
            material={index === 1 ? materials.redBand : materials.canvas}
            position={[0, 2, 0.2]}
            rotation={[0.35, 0, 0]}
          >
            <boxGeometry args={[1.9, 0.05, 1.5]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Dock({ materials }: { materials: Materials }) {
  // A shipyard: a slipway running into the sea with a hull in frame on it, and a crane.
  const rib = useMemo(() => new TorusGeometry(2.1, 0.12, 5, 16, Math.PI), []);
  useEffect(() => () => rib.dispose(), [rib]);
  const jib = useRef<Group>(null);
  useFrame(() => {
    // Opened to read, the crane swings its jib out over the hull and back.
    const { on } = placeFx('dock');
    if (jib.current) jib.current.rotation.y = on * Math.sin(voyage.time * 0.9) * 0.55;
  });
  return (
    <group>
      <Glow color="#ff9a4a" fx="dock" position={[0, 3.4, 8]} size={7} strength={0.25} />
      <group position={[0, 1.6, 8]} rotation={[-0.2, 0, 0]}>
        <mesh material={materials.timber}>
          <boxGeometry args={[5, 0.4, 16]} />
        </mesh>
        <mesh material={materials.darkTimber} position={[0, 0.6, 0]}>
          <boxGeometry args={[0.35, 0.5, 13]} />
        </mesh>
        {Array.from({ length: 9 }, (_, index) => (
          <mesh
            geometry={rib}
            key={index}
            material={materials.timber}
            position={[0, 0.7, -5.5 + index * 1.4]}
            rotation={[0, 0, Math.PI]}
            scale={[0.75 + Math.sin((index / 8) * Math.PI) * 0.35, 1, 1]}
          />
        ))}
      </group>
      <mesh castShadow material={materials.darkTimber} position={[-4, PLATEAU + 5, 1]}>
        <boxGeometry args={[0.5, 10, 0.5]} />
      </mesh>
      <group position={[-4, 0, 1]} ref={jib}>
        <mesh
          material={materials.darkTimber}
          position={[2.5, PLATEAU + 9.6, 2]}
          rotation={[0.6, 0, 0]}
        >
          <boxGeometry args={[0.35, 0.35, 8]} />
        </mesh>
      </group>
      <House
        at={[4, -3]}
        body={materials.warmPlaster}
        materials={materials}
        rotation={0.5}
        size={[5, 3, 3.6]}
      />
    </group>
  );
}

function Library({ materials }: { materials: Materials }) {
  const windows = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new BoxGeometry(0.5, 1.1, 0.1), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    let index = 0;
    for (const level of [5, 9, 13]) {
      for (let k = 0; k < 10; k += 1) {
        const angle = (k / 10) * Math.PI * 2;
        dummy.position.set(Math.cos(angle) * 3.25, PLATEAU + level, Math.sin(angle) * 3.25);
        dummy.rotation.set(0, -angle + Math.PI / 2, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        windows.current?.setMatrixAt(index, dummy.matrix);
        index += 1;
      }
    }
    if (windows.current) windows.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      <mesh castShadow material={materials.stone} position={[0, PLATEAU + 8, 0]}>
        <cylinderGeometry args={[3.2, 3.6, 16, 32]} />
      </mesh>
      <mesh castShadow material={materials.copper} position={[0, PLATEAU + 16, 0]}>
        <sphereGeometry args={[3.4, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh material={materials.copper} position={[0, PLATEAU + 20, 0]}>
        <coneGeometry args={[0.35, 1.8, 8]} />
      </mesh>
      <instancedMesh args={[geometry, materials.window, 30]} ref={windows} />
      <Glow
        color="#ffd9a0"
        fx="library"
        position={[0, PLATEAU + 20.6, 0]}
        size={8}
        strength={0.45}
      />
      <House
        at={[5, 2]}
        body={materials.plaster}
        materials={materials}
        rotation={-0.6}
        size={[3.6, 2.8, 3]}
      />
    </group>
  );
}

function Signal({ materials }: { materials: Materials }) {
  const flags = useRef<Group>(null);
  useFrame(({ clock }) => {
    const group = flags.current;
    if (!group) return;
    for (const [index, child] of group.children.entries()) {
      // Opened to read, the flags snap in a stiffer breeze.
      const { on } = placeFx('signal');
      child.rotation.y = Math.sin(clock.elapsedTime * (2.2 + on * 5) + index) * (0.35 + on * 0.45);
    }
  });
  return (
    <group>
      <mesh castShadow material={materials.darkTimber} position={[0, PLATEAU + 9, 0]}>
        <cylinderGeometry args={[0.22, 0.32, 18, 10]} />
      </mesh>
      <mesh material={materials.darkTimber} position={[0, PLATEAU + 15, 0]}>
        <boxGeometry args={[0.2, 0.2, 7]} />
      </mesh>
      <group ref={flags}>
        {[
          [-3, '#c9443a'],
          [-1.5, '#e8b04a'],
          [1.5, '#2f6f9a'],
          [3, '#e9dcc6'],
        ].map(([z, color]) => (
          <mesh key={z as number} position={[0.7, PLATEAU + 14, z as number]}>
            <planeGeometry args={[1.4, 1]} />
            <meshStandardMaterial color={color as string} roughness={0.9} side={DoubleSide} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, PLATEAU + 18.4, 0]}>
        <sphereGeometry args={[0.35, 12, 8]} />
        <meshBasicMaterial color="#ffb85c" toneMapped={false} />
      </mesh>
      <Glow color="#ffb85c" fx="signal" position={[0, PLATEAU + 18.4, 0]} size={5} />
      <House at={[3, 2]} body={materials.warmPlaster} materials={materials} size={[3, 2.6, 2.8]} />
    </group>
  );
}

function Trading({ materials }: { materials: Materials }) {
  const roof = useMemo(() => gable(6, 12, 2.6), []);
  useEffect(() => () => roof.dispose(), [roof]);
  return (
    <group>
      <group position={[0, PLATEAU, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh castShadow material={materials.timber} position={[0, 2.5, 0]}>
          <boxGeometry args={[5.4, 5, 11.4]} />
        </mesh>
        <mesh castShadow geometry={roof} material={materials.roof} position={[0, 5, 0]} />
        <mesh material={materials.darkTimber} position={[2.72, 2, 0]}>
          <boxGeometry args={[0.05, 3.2, 3]} />
        </mesh>
      </group>
      {[
        [3.6, 6],
        [4.6, 6.4],
        [4.1, 5.2],
        [-3.8, 6.5],
      ].map(([x, z], index) => (
        <mesh
          castShadow
          key={`${x}:${z}`}
          material={materials.timber}
          position={[x as number, PLATEAU + 0.5 + (index === 2 ? 1 : 0), z as number]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      ))}
      <mesh material={materials.timber} position={[0, 0.9, 14]}>
        <boxGeometry args={[3, 0.35, 12]} />
      </mesh>
      <Glow
        color="#ffd24a"
        fx="trading"
        position={[4.1, PLATEAU + 1.6, 6]}
        size={7}
        strength={0.3}
      />
    </group>
  );
}

function Tavern({ materials }: { materials: Materials }) {
  const roof = useMemo(() => gable(7.2, 6, 3.4), []);
  useEffect(() => () => roof.dispose(), [roof]);
  return (
    <group position={[0, PLATEAU, 0]}>
      <mesh castShadow material={materials.warmPlaster} position={[0, 2.4, 0]}>
        <boxGeometry args={[6.6, 4.8, 5.4]} />
      </mesh>
      {/* Timber framing. */}
      {[-3.3, -1.1, 1.1, 3.3].map((x) => (
        <mesh key={x} material={materials.darkTimber} position={[x, 2.4, 2.72]}>
          <boxGeometry args={[0.25, 4.8, 0.08]} />
        </mesh>
      ))}
      <mesh castShadow geometry={roof} material={materials.roof} position={[0, 4.8, 0]} />
      <mesh material={materials.darkStone} position={[2.2, 7, -1]}>
        <boxGeometry args={[0.9, 3, 0.9]} />
      </mesh>
      {[-2.2, 0, 2.2].map((x) => (
        <mesh key={x} material={materials.window} position={[x, 2.6, 2.75]}>
          <boxGeometry args={[1, 1.1, 0.05]} />
        </mesh>
      ))}
      <Glow color="#ffae5a" fx="tavern" position={[0, 2.6, 3.8]} size={7} strength={0.8} />
    </group>
  );
}

function Beacon({ materials }: { materials: Materials }) {
  return (
    <group>
      <mesh castShadow material={materials.stone} position={[0, PLATEAU + 3, 0]}>
        <cylinderGeometry args={[0.6, 0.9, 6, 10]} />
      </mesh>
      <mesh position={[0, PLATEAU + 6.6, 0]}>
        <sphereGeometry args={[0.6, 14, 10]} />
        <meshBasicMaterial color="#ffc070" toneMapped={false} />
      </mesh>
      <Glow color="#ffc070" position={[0, PLATEAU + 6.6, 0]} size={8} strength={0.9} />
    </group>
  );
}

function Landmark({
  building,
  materials,
  slices,
}: {
  building: Building;
  materials: Materials;
  slices: ActivitySlice[];
}) {
  switch (building) {
    case 'lighthouse': {
      return <Lighthouse materials={materials} />;
    }
    case 'clocktower': {
      return <ClockTower materials={materials} slices={slices} />;
    }
    case 'twinlights': {
      return <TwinLights materials={materials} />;
    }
    case 'market': {
      return <Market materials={materials} />;
    }
    case 'dock': {
      return <Dock materials={materials} />;
    }
    case 'library': {
      return <Library materials={materials} />;
    }
    case 'signal': {
      return <Signal materials={materials} />;
    }
    case 'trading': {
      return <Trading materials={materials} />;
    }
    case 'tavern': {
      return <Tavern materials={materials} />;
    }
    default: {
      return <Beacon materials={materials} />;
    }
  }
}

/**
 * The flag a place flies once its log has been read: it climbs its pole and streams in the
 * wind, so the archipelago shows at a glance which places the visitor has been to.
 */
function Flag({ id, radius }: { id: string; radius: number }) {
  const flag = useRef<Group>(null);
  const cloth = useRef<Mesh>(null);
  const level = useRef(0);
  useFrame((_, delta) => {
    const flown = timeMotion.visited.split(',').includes(id) ? 1 : 0;
    level.current += (flown - level.current) * (1 - Math.exp(-2.2 * Math.min(delta, 0.1)));
    if (!flag.current) return;
    flag.current.visible = level.current > 0.01 || !voyage.shown;
    flag.current.scale.setScalar(Math.max(0.001, level.current));
    if (cloth.current) cloth.current.rotation.y = Math.sin(voyage.time * 3.1) * 0.35;
  });
  return (
    <group position={[radius * 0.36, PLATEAU, -radius * 0.16]} ref={flag}>
      <mesh position={[0, 4.5, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 9, 6]} />
        <meshStandardMaterial color="#2c1f16" roughness={0.8} />
      </mesh>
      <group position={[0, 8.2, 0]} ref={cloth}>
        <mesh position={[1.25, 0, 0]}>
          <planeGeometry args={[2.5, 1.4]} />
          <meshStandardMaterial
            color="#f2b35e"
            emissive="#f2b35e"
            emissiveIntensity={0.35}
            roughness={0.8}
            side={DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}

function Island({
  detail,
  materials,
  place,
  slices,
}: {
  detail: number;
  materials: Materials;
  place: Place;
  slices: ActivitySlice[];
}) {
  const seed = Math.round(Math.abs(place.at[0] * 7 + place.at[1] * 13));
  const geometry = useMemo(() => islandGeometry(place.radius, seed), [place.radius, seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group
      position={[place.at[0], 0, place.at[1]]}
      rotation={[0, facing(place), 0]}
      scale={ISLAND_SCALE}
    >
      <mesh geometry={geometry} material={materials.island} receiveShadow />
      <Dressing detail={detail} materials={materials} radius={place.radius} seed={seed + 2} />
      <Trees
        count={Math.round(place.radius * (0.7 + 0.5 * detail))}
        materials={materials}
        radius={place.radius}
        seed={seed + 1}
      />
      <Landmark building={place.building} materials={materials} slices={slices} />
      {place.sections.length > 0 ? <Flag id={place.id} radius={place.radius} /> : null}
    </group>
  );
}

/** Every island in the archipelago. Windows and beacons warm up as dusk falls. */
export function Islands({ detail = 1, slices }: { detail?: number; slices: ActivitySlice[] }) {
  const materials = useMaterials();
  useFrame(() => {
    materials.window.emissiveIntensity = 0.5 + voyage.lanterns * 2.4;
  });
  return (
    <group>
      {PLACES.filter((place) => place.building !== 'ship').map((place) => (
        <Island
          detail={detail}
          key={place.id}
          materials={materials}
          place={place}
          slices={slices}
        />
      ))}
    </group>
  );
}
