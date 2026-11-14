'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  type Group,
  IcosahedronGeometry,
  type InstancedMesh,
  LatheGeometry,
  type LineBasicMaterial,
  type Mesh,
  type MeshBasicMaterial,
  Object3D,
  type PointLight,
  type ShaderMaterial,
  SphereGeometry,
  TetrahedronGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';

import { seededRandom } from '../time-data';
import { dampFactor } from '../time-keyframes';
import { timeMotion } from '../time-store';

import { dotTexture } from './heartbeats';
import { MATERIALS, SCENE } from './scene-palette';

const TAU = Math.PI * 2;
const dummy = new Object3D();
const CYAN = new Color(SCENE.human);
const AMBER = new Color(SCENE.ai);

/** Smooth 0 → 1 over [from, to]. */
function ramp(value: number, from: number, to: number) {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/**
 * The awakening, as a share of the opening: dormant metal first, then the energy lines,
 * then the nucleus. `wake` runs 0 → 1 once, from the first frame (see time-rig).
 */
export function awakening(wake: number) {
  return {
    metal: ramp(wake, 0, 0.45),
    lines: ramp(wake, 0.3, 0.75),
    nucleus: ramp(wake, 0.55, 1),
  };
}

/** A machined washer: a rectangular profile turned around the axis, lying in the XY plane. */
function washerGeometry(inner: number, outer: number, depth: number, segments = 192) {
  const h = depth / 2;
  const profile = [
    new Vector2(inner, -h),
    new Vector2(outer, -h),
    new Vector2(outer, h),
    new Vector2(inner + (outer - inner) * 0.35, h),
    new Vector2(inner, h * 0.4),
    new Vector2(inner, -h),
  ];
  const geometry = new LatheGeometry(profile, segments);
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function circlePoints(radius: number, segments = 256, squash = 1) {
  const points: Vector3[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * TAU;
    points.push(new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * squash, 0));
  }
  return new BufferGeometry().setFromPoints(points);
}

/* ---------- the nucleus ---------- */

const NUCLEUS_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    vec4 world = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-world.xyz);
    gl_Position = projectionMatrix * world;
  }
`;

/** A lit plasma: bright core, fresnel rim, slow latitudinal bands of energy. */
const NUCLEUS_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uPower;
  uniform vec3 uCyan;
  uniform vec3 uAmber;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  void main() {
    float facing = clamp(dot(vNormal, vView), 0.0, 1.0);
    float rim = pow(1.0 - facing, 2.4);
    float bands = 0.5 + 0.5 * sin(vLocal.y * 22.0 - uTime * 1.6 + sin(vLocal.x * 9.0 + uTime) * 1.2);
    float swirl = 0.5 + 0.5 * sin(atan(vLocal.z, vLocal.x) * 6.0 + uTime * 0.7 + vLocal.y * 8.0);
    vec3 core = mix(uCyan, vec3(1.0), pow(facing, 3.0) * 0.85);
    vec3 color = core * (0.55 + 0.45 * bands * swirl) + uCyan * rim * 1.4 + uAmber * rim * swirl * 0.25;
    gl_FragColor = vec4(color * uPower, 1.0);
  }
`;

function Nucleus() {
  const shell = useRef<ShaderMaterial>(null);
  const halo = useRef<MeshBasicMaterial>(null);
  const flare = useRef<MeshBasicMaterial>(null);
  const light = useRef<PointLight>(null);
  const body = useRef<Mesh>(null);
  const dot = useMemo(() => dotTexture(), []);
  const geometry = useMemo(() => new SphereGeometry(0.34, 64, 48), []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPower: { value: 0 },
      uCyan: { value: CYAN.clone() },
      uAmber: { value: AMBER.clone() },
    }),
    []
  );

  useEffect(
    () => () => {
      geometry.dispose();
      dot.dispose();
    },
    [dot, geometry]
  );

  useFrame(({ clock }) => {
    const { nucleus } = awakening(timeMotion.wake);
    const breathe = 0.92 + Math.sin(clock.elapsedTime * 1.1) * 0.08;
    // Written through the live material: React Three Fiber may hand it a copy of `uniforms`.
    const live = shell.current?.uniforms;
    if (live?.uTime && live.uPower) {
      live.uTime.value = clock.elapsedTime;
      live.uPower.value = 0.08 + nucleus * 1.05 * breathe;
    }
    if (body.current) body.current.scale.setScalar(0.55 + nucleus * 0.45);
    if (halo.current) halo.current.opacity = nucleus * 0.55 * breathe;
    if (flare.current) flare.current.opacity = nucleus * 0.22;
    if (light.current) light.current.intensity = 2 + nucleus * 38 * breathe;
  });

  return (
    <group>
      <mesh geometry={geometry} ref={body}>
        <shaderMaterial
          fragmentShader={NUCLEUS_FRAGMENT}
          ref={shell}
          toneMapped={false}
          uniforms={uniforms}
          vertexShader={NUCLEUS_VERTEX}
        />
      </mesh>
      <mesh renderOrder={2}>
        <planeGeometry args={[2.6, 2.6]} />
        <meshBasicMaterial
          blending={AdditiveBlending}
          color={SCENE.human}
          depthWrite={false}
          map={dot}
          opacity={0}
          ref={halo}
          toneMapped={false}
          transparent
        />
      </mesh>
      {/* A thin horizontal anamorphic streak — restrained, no lens-flare theatrics. */}
      <mesh renderOrder={2} scale={[9, 0.05, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          blending={AdditiveBlending}
          color={SCENE.highlight}
          depthWrite={false}
          map={dot}
          opacity={0}
          ref={flare}
          toneMapped={false}
          transparent
        />
      </mesh>
      <pointLight color={SCENE.human} decay={2} distance={16} intensity={2} ref={light} />
    </group>
  );
}

/* ---------- the machinery ---------- */

interface Assembly {
  /** Energy line colour. */
  energy: 'amber' | 'cyan';
  kind: 'arcs' | 'precision' | 'stabilised' | 'washer';
  radius: number;
  /** Spin around its own axis, radians per second. */
  spin: number;
  /** Fixed tilt of the assembly's axis (radians, x then y). */
  tilt: [number, number];
}

const ASSEMBLIES: readonly Assembly[] = [
  { kind: 'washer', radius: 3.2, tilt: [1.18, 0.34], spin: 0.07, energy: 'cyan' },
  { kind: 'stabilised', radius: 3.85, tilt: [0.42, -0.9], spin: -0.045, energy: 'cyan' },
  { kind: 'arcs', radius: 4.55, tilt: [1.45, -0.18], spin: 0.03, energy: 'amber' },
  { kind: 'precision', radius: 5.35, tilt: [0.16, 0.22], spin: -0.012, energy: 'cyan' },
];

function useMetal(color: string, roughness: number, metalness = 0.92) {
  return useMemo(() => ({ color, roughness, metalness }), [color, metalness, roughness]);
}

function EnergyLine({ assembly, radius }: { assembly: Assembly; radius: number }) {
  const material = useRef<LineBasicMaterial>(null);
  const geometry = useMemo(() => circlePoints(radius), [radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const phase = useMemo(() => radius * 1.7, [radius]);
  useFrame(({ clock }) => {
    const { lines } = awakening(timeMotion.wake);
    if (!material.current) return;
    const shimmer = 0.75 + Math.sin(clock.elapsedTime * 0.9 + phase) * 0.25;
    material.current.opacity = lines * shimmer * (assembly.energy === 'amber' ? 0.75 : 0.9);
  });
  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial
        blending={AdditiveBlending}
        color={assembly.energy === 'amber' ? SCENE.ai : SCENE.human}
        depthWrite={false}
        opacity={0}
        ref={material}
        toneMapped={false}
        transparent
      />
    </lineLoop>
  );
}

function Washer({ assembly }: { assembly: Assembly }) {
  const geometry = useMemo(
    () => washerGeometry(assembly.radius - 0.16, assembly.radius + 0.1, 0.12),
    [assembly.radius]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  const metal = useMetal(MATERIALS.titanium, 0.34);
  return (
    <>
      <mesh geometry={geometry}>
        <meshStandardMaterial {...metal} envMapIntensity={0.9} />
      </mesh>
      <group position={[0, 0, 0.065]}>
        <EnergyLine assembly={assembly} radius={assembly.radius - 0.03} />
      </group>
    </>
  );
}

/** A thin torus carrying stabiliser pods at regular stations. */
function Stabilised({ assembly }: { assembly: Assembly }) {
  const pods = useRef<InstancedMesh>(null);
  const torus = useMemo(() => new TorusGeometry(assembly.radius, 0.028, 12, 256), [assembly]);
  const pod = useMemo(() => new BoxGeometry(0.16, 0.11, 0.34), []);
  const count = 12;
  useEffect(() => {
    const mesh = pods.current;
    if (!mesh) return;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * TAU;
      dummy.position.set(Math.cos(angle) * assembly.radius, Math.sin(angle) * assembly.radius, 0);
      dummy.rotation.set(0, 0, angle);
      dummy.scale.setScalar(index % 3 === 0 ? 1.4 : 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [assembly.radius]);
  useEffect(
    () => () => {
      torus.dispose();
      pod.dispose();
    },
    [pod, torus]
  );
  const metal = useMetal(MATERIALS.titanium, 0.28);
  const dark = useMetal(MATERIALS.aluminium, 0.5, 0.75);
  return (
    <>
      <mesh geometry={torus}>
        <meshStandardMaterial {...metal} envMapIntensity={1} />
      </mesh>
      <instancedMesh args={[pod, undefined, count]} ref={pods}>
        <meshStandardMaterial {...dark} envMapIntensity={0.7} />
      </instancedMesh>
      <EnergyLine assembly={assembly} radius={assembly.radius + 0.06} />
    </>
  );
}

/** Three heavy arcs with gaps between them, like a partly opened shutter. */
function Arcs({ assembly }: { assembly: Assembly }) {
  const arc = useMemo(
    () => new TorusGeometry(assembly.radius, 0.07, 10, 128, (TAU / 3) * 0.82),
    [assembly.radius]
  );
  useEffect(() => () => arc.dispose(), [arc]);
  const metal = useMetal(MATERIALS.aluminium, 0.42);
  return (
    <>
      {[0, 1, 2].map((index) => (
        <mesh geometry={arc} key={index} rotation={[0, 0, (index * TAU) / 3]}>
          <meshStandardMaterial {...metal} envMapIntensity={0.8} />
        </mesh>
      ))}
      <EnergyLine assembly={assembly} radius={assembly.radius - 0.12} />
    </>
  );
}

/** A hairline ring with precision graduations: 240 fine marks, every tenth long. */
function Precision({ assembly }: { assembly: Assembly }) {
  const marks = useRef<InstancedMesh>(null);
  const line = useMemo(() => circlePoints(assembly.radius, 384), [assembly.radius]);
  const mark = useMemo(() => new BoxGeometry(1, 0.008, 0.008), []);
  const count = 240;
  useEffect(() => {
    const mesh = marks.current;
    if (!mesh) return;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * TAU;
      const long = index % 10 === 0;
      const length = long ? 0.26 : 0.09;
      const r = assembly.radius + length / 2 + 0.03;
      dummy.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
      dummy.rotation.set(0, 0, angle);
      dummy.scale.set(length, long ? 1.8 : 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [assembly.radius]);
  useEffect(
    () => () => {
      line.dispose();
      mark.dispose();
    },
    [line, mark]
  );
  return (
    <>
      <lineLoop geometry={line}>
        <lineBasicMaterial color={SCENE.ink} opacity={0.22} transparent />
      </lineLoop>
      <instancedMesh args={[mark, undefined, count]} ref={marks}>
        <meshBasicMaterial color={SCENE.ink} opacity={0.4} transparent />
      </instancedMesh>
    </>
  );
}

const PARTS = { washer: Washer, stabilised: Stabilised, arcs: Arcs, precision: Precision };

function Machinery() {
  const groups = useRef<(Group | null)[]>([]);
  const speed = useRef(0);
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const { metal } = awakening(timeMotion.wake);
    // The machinery spins up as it wakes, and a fast scroll leans on it a little.
    const wanted = metal * (1 + timeMotion.warp * 2.5);
    speed.current += (wanted - speed.current) * dampFactor(delta, 1.6);
    for (const [index, assembly] of ASSEMBLIES.entries()) {
      const group = groups.current[index];
      if (group) group.rotation.z += assembly.spin * speed.current * delta;
    }
  });
  return (
    <>
      {ASSEMBLIES.map((assembly, index) => {
        const Part = PARTS[assembly.kind];
        return (
          <group key={assembly.kind} rotation={[assembly.tilt[0], assembly.tilt[1], 0]}>
            <group
              ref={(node) => {
                groups.current[index] = node;
              }}
            >
              <Part assembly={assembly} />
            </group>
          </group>
        );
      })}
    </>
  );
}

/* ---------- the outer shell, trajectories and debris ---------- */

/** Rough ceramic fragments of a sphere that once enclosed the core. */
function Shell() {
  const group = useRef<Group>(null);
  // phi in (π, 2π) puts every fragment behind the core (z < 0), so the shell frames the
  // machinery from behind and never blocks the camera's view of it.
  const fragments = useMemo(
    () => [
      new SphereGeometry(7.4, 48, 24, 3.5, 1.15, 0.5, 0.55),
      new SphereGeometry(7.8, 48, 24, 4.75, 0.85, 1.45, 0.42),
      new SphereGeometry(7.1, 48, 24, 5.35, 0.7, 0.95, 0.36),
    ],
    []
  );
  useEffect(() => () => fragments.forEach((geometry) => geometry.dispose()), [fragments]);
  useFrame(({ clock }) => {
    // A barely perceptible sway around the view axis; the fragments stay behind the core.
    if (group.current) group.current.rotation.z = Math.sin(clock.elapsedTime * 0.03) * 0.12;
  });
  return (
    <group ref={group} rotation={[0.12, 0, 0]}>
      {fragments.map((geometry) => (
        <mesh geometry={geometry} key={geometry.uuid}>
          <meshStandardMaterial
            color={MATERIALS.ceramic}
            envMapIntensity={0.35}
            metalness={0.08}
            roughness={0.88}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

interface Trajectory {
  radius: number;
  speed: number;
  squash: number;
  tilt: [number, number, number];
}

const TRAJECTORIES: readonly Trajectory[] = [
  { radius: 6.1, squash: 0.42, tilt: [0.4, 0.2, 0.5], speed: 0.09 },
  { radius: 7.4, squash: 0.3, tilt: [-0.3, -0.5, -0.4], speed: -0.06 },
  { radius: 8.6, squash: 0.55, tilt: [1.1, 0.1, 0.2], speed: 0.04 },
];
const RIDERS = 7;

/** Thin data trajectories orbiting the core, each carrying a few lit fragments. */
function Trajectories() {
  const riders = useRef<InstancedMesh>(null);
  const lines = useMemo(
    () => TRAJECTORIES.map((path) => circlePoints(path.radius, 256, path.squash)),
    []
  );
  const rider = useMemo(() => new IcosahedronGeometry(0.045, 0), []);
  const total = TRAJECTORIES.length * RIDERS;
  const holders = useMemo(
    () =>
      TRAJECTORIES.map((path) => {
        const holder = new Object3D();
        holder.rotation.set(...path.tilt);
        holder.updateMatrixWorld();
        return holder;
      }),
    []
  );
  const point = useMemo(() => new Vector3(), []);
  useEffect(
    () => () => {
      lines.forEach((geometry) => geometry.dispose());
      rider.dispose();
    },
    [lines, rider]
  );
  useFrame(({ clock }) => {
    const mesh = riders.current;
    if (!mesh) return;
    const { lines: lit } = awakening(timeMotion.wake);
    let index = 0;
    for (const [pathIndex, path] of TRAJECTORIES.entries()) {
      const holder = holders[pathIndex] as Object3D;
      for (let n = 0; n < RIDERS; n += 1) {
        const angle = clock.elapsedTime * path.speed + (n / RIDERS) * TAU + n * 0.31;
        point.set(Math.cos(angle) * path.radius, Math.sin(angle) * path.radius * path.squash, 0);
        point.applyMatrix4(holder.matrixWorld);
        dummy.position.copy(point);
        dummy.scale.setScalar(lit * (n % 3 === 0 ? 1.6 : 1));
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        index += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      {TRAJECTORIES.map((path, index) => (
        <lineLoop geometry={lines[index]} key={path.radius} rotation={path.tilt}>
          <lineBasicMaterial
            blending={AdditiveBlending}
            color={SCENE.human}
            depthWrite={false}
            opacity={0.13}
            toneMapped={false}
            transparent
          />
        </lineLoop>
      ))}
      <instancedMesh args={[rider, undefined, total]} frustumCulled={false} ref={riders}>
        <meshBasicMaterial color={SCENE.highlight} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

/** Slow metallic shards drifting in a loose shell around the machinery. */
function Debris({ count }: { count: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new TetrahedronGeometry(0.11, 0), []);
  const seeds = useMemo(() => {
    const random = seededRandom(707);
    return Array.from({ length: count }, () => ({
      radius: 5.8 + random() * 5,
      angle: random() * TAU,
      height: (random() - 0.5) * 6,
      depth: (random() - 0.5) * 6,
      speed: (random() - 0.5) * 0.05,
      scale: 0.4 + random() * 1.4,
      spin: random() * TAU,
    }));
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    const instance = mesh.current;
    if (!instance) return;
    const t = clock.elapsedTime;
    for (const [index, seed] of seeds.entries()) {
      const angle = seed.angle + t * seed.speed;
      dummy.position.set(
        Math.cos(angle) * seed.radius,
        seed.height + Math.sin(t * 0.2 + seed.spin) * 0.15,
        Math.sin(angle) * seed.radius * 0.6 + seed.depth
      );
      dummy.rotation.set(seed.spin + t * 0.1, seed.spin * 2 + t * 0.07, 0);
      dummy.scale.setScalar(seed.scale);
      dummy.updateMatrix();
      instance.setMatrixAt(index, dummy.matrix);
    }
    instance.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh args={[geometry, undefined, count]} frustumCulled={false} ref={mesh}>
      <meshStandardMaterial
        color={MATERIALS.titanium}
        envMapIntensity={0.8}
        metalness={0.9}
        roughness={0.35}
      />
    </instancedMesh>
  );
}

/**
 * The AtoAxis Intelligence Core: a suspended energy nucleus inside independently rotating
 * machined rings, stabilisers, precision graduations, a broken ceramic shell, orbiting data
 * trajectories and drifting debris. Custom and procedural — no downloaded assets. Today's
 * dial (TimeRings) sits in its plane, so the core's rings and the day's ring are one object.
 */
export function IntelligenceCore({ debris, shell }: { debris: number; shell: boolean }) {
  return (
    <group>
      <Nucleus />
      <Machinery />
      <Trajectories />
      {shell ? <Shell /> : null}
      {debris > 0 ? <Debris count={debris} /> : null}
    </group>
  );
}
