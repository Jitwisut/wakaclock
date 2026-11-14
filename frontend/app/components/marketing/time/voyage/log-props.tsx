'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  type InstancedMesh,
  type MeshBasicMaterial,
  Object3D,
  type PointLight,
  type ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';

import { COMPATIBLE_EDITORS } from '../../editor-wall.data';
import { type ActivitySlice, MINUTES_PER_DAY, type SliceKind, sliceRuns } from '../time-data';

import { chipLogMarkers } from './chip-log';
import { deckHeight, gunwalePoints, hullX, sheerHeight } from './hull';
import { voyage } from './state';
import { GERSTNER_GLSL } from './waves';

const dummy = new Object3D();
const scratch = new Color();

/** Human work glows lantern-gold, AI work sea-teal, unattributed stays a cool grey. */
export const KIND_LIGHT: Record<SliceKind, Color> = {
  human: new Color('#ffb85c'),
  ai: new Color('#46d6c8'),
  unattributed: new Color('#7d8794'),
};

function kindWeight(kind: SliceKind) {
  if (kind === 'human') return voyage.human;
  if (kind === 'ai') return voyage.ai;
  return 0.5 + (voyage.fog > 0.5 ? 0.6 : 0);
}

/* ---------- the chip log in the wake ---------- */

const MARKER_VERTEX = /* glsl */ `
${GERSTNER_GLSL}
uniform float uTime;
varying vec3 vColor;
void main() {
  vec3 centre = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 normal;
  vec3 offset = gerstner(centre.xz, uTime, length(centre.xz - cameraPosition.xz), normal);
  vec3 world = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz + offset + vec3(0.0, 0.1, 0.0);
  #ifdef USE_INSTANCING_COLOR
    vColor = instanceColor;
  #else
    vColor = vec3(1.0);
  #endif
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const MARKER_FRAGMENT = /* glsl */ `
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * One lit marker per demo heartbeat, floating on the swell astern. Re-laid out only when
 * the clock moves a minute or the focus changes; the bobbing happens on the GPU.
 */
export function ChipLog({ slices }: { slices: ActivitySlice[] }) {
  const mesh = useRef<InstancedMesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => new SphereGeometry(0.075, 8, 6), []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSea: { value: 0 } }), []);
  const last = useRef({ hand: -1, focus: '' });
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const live = material.current?.uniforms as
      | { uSea: { value: number }; uTime: { value: number } }
      | undefined;
    if (live?.uTime) {
      live.uTime.value = voyage.time;
      live.uSea.value = voyage.sea;
    }
    const instance = mesh.current;
    if (!instance) return;
    const hand = Math.floor(voyage.hand);
    const focus = `${voyage.human.toFixed(2)}:${voyage.ai.toFixed(2)}:${voyage.fog.toFixed(2)}`;
    if (last.current.hand === hand && last.current.focus === focus) return;
    last.current = { hand, focus };
    const markers = chipLogMarkers(slices, hand, COMPATIBLE_EDITORS.length);
    for (const [index, marker] of markers.entries()) {
      dummy.position.set(marker.x, 0, marker.z);
      dummy.rotation.set(0, 0, 0);
      // Fresh markers are larger and brighter; old ones settle to a steady glow.
      const fresh = Math.max(0, 1 - marker.age / 30);
      dummy.scale.setScalar(1 + fresh * 0.9);
      dummy.updateMatrix();
      instance.setMatrixAt(index, dummy.matrix);
      scratch
        .copy(KIND_LIGHT[marker.kind])
        .multiplyScalar((1.4 + fresh * 2.5) * kindWeight(marker.kind));
      instance.setColorAt(index, scratch);
    }
    instance.count = markers.length;
    instance.instanceMatrix.needsUpdate = true;
    if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh args={[geometry, undefined, slices.length]} frustumCulled={false} ref={mesh}>
      <shaderMaterial
        fragmentShader={MARKER_FRAGMENT}
        ref={material}
        uniforms={uniforms}
        vertexShader={MARKER_VERTEX}
      />
    </instancedMesh>
  );
}

/* ---------- lanterns: one per supported editor, plus the stern lights ---------- */

interface LanternSpot {
  position: [number, number, number];
  size: number;
}

/** Lanterns evenly along one rail, on short posts just inboard of the sheer. */
function railLanterns(count: number, side: -1 | 1): LanternSpot[] {
  return gunwalePoints(count, side, 0.12, 0.88).map(([x, y, z]) => ({
    position: [x, y + 0.32, z - side * 0.12] as [number, number, number],
    size: 0.75,
  }));
}

export function lanternSpots(count: number): LanternSpot[] {
  const starboard = Math.ceil(count / 2);
  const port = count - starboard;
  const sternY = sheerHeight(0) + 0.6;
  const stern: LanternSpot[] = [-1.1, 0, 1.1].map((z) => ({
    position: [hullX(0, 1) - 0.25, sternY + (z === 0 ? 0.35 : 0), z],
    size: 1.9,
  }));
  return [...railLanterns(starboard, 1), ...railLanterns(port, -1), ...stern];
}

/**
 * The lanterns. Each rail lantern stands for one supported editor (the real count from the
 * editor list); when that editor's demo heartbeat drops a marker, its lantern flares. The
 * three stern lanterns are the ship's own. All burn brighter as dusk falls, and brighter
 * still when "human" is in focus.
 */
export function Lanterns() {
  const spots = useMemo(() => lanternSpots(COMPATIBLE_EDITORS.length), []);
  const glass = useRef<InstancedMesh>(null);
  const caps = useRef<InstancedMesh>(null);
  const bases = useRef<InstancedMesh>(null);
  const halo = useRef<InstancedMesh>(null);
  const sternLight = useRef<PointLight>(null);
  const deckLight = useRef<PointLight>(null);
  const haloMaterial = useRef<MeshBasicMaterial>(null);
  const geometries = useMemo(
    () => ({
      glass: new CylinderGeometry(0.075, 0.075, 0.2, 8),
      cap: new ConeGeometry(0.11, 0.1, 8),
      base: new BoxGeometry(0.17, 0.04, 0.17),
      halo: new SphereGeometry(0.22, 10, 8),
    }),
    []
  );
  useEffect(
    () => () => {
      for (const geometry of Object.values(geometries)) geometry.dispose();
    },
    [geometries]
  );
  useEffect(() => {
    for (const [index, spot] of spots.entries()) {
      const [x, y, z] = spot.position;
      const place = (mesh: InstancedMesh | null, dy: number) => {
        if (!mesh) return;
        dummy.position.set(x, y + dy * spot.size, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(spot.size);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      };
      place(glass.current, 0);
      place(caps.current, 0.15);
      place(bases.current, -0.12);
      place(halo.current, 0);
    }
    for (const mesh of [glass, caps, bases, halo]) {
      if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
    }
  }, [spots]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const level = voyage.lanterns * (0.55 + 0.45 * voyage.human);
    const instance = glass.current;
    if (instance) {
      for (let index = 0; index < spots.length; index += 1) {
        const flicker = 0.9 + 0.1 * Math.sin(t * 9.1 + index * 1.7) * Math.sin(t * 5.3 + index);
        const pulse =
          index === voyage.pulseLantern ? Math.max(0, 1 - voyage.pulseAge / 0.9) * 2.4 : 0;
        scratch.copy(KIND_LIGHT.human).multiplyScalar((0.6 + level * 2.6) * flicker + pulse);
        instance.setColorAt(index, scratch);
      }
      if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
    }
    if (haloMaterial.current) haloMaterial.current.opacity = 0.05 + level * 0.18;
    const flame = 0.92 + 0.08 * Math.sin(t * 7.7) * Math.sin(t * 3.1);
    if (sternLight.current) sternLight.current.intensity = level * 14 * flame;
    if (deckLight.current) deckLight.current.intensity = level * 10 * flame;
  });
  const deckY = deckHeight(0.5) + 3;
  return (
    <group>
      <instancedMesh args={[geometries.glass, undefined, spots.length]} ref={glass}>
        <meshBasicMaterial toneMapped />
      </instancedMesh>
      <instancedMesh args={[geometries.cap, undefined, spots.length]} ref={caps}>
        <meshStandardMaterial color="#2a2320" metalness={0.7} roughness={0.45} />
      </instancedMesh>
      <instancedMesh args={[geometries.base, undefined, spots.length]} ref={bases}>
        <meshStandardMaterial color="#2a2320" metalness={0.7} roughness={0.45} />
      </instancedMesh>
      <instancedMesh args={[geometries.halo, undefined, spots.length]} ref={halo}>
        <meshBasicMaterial
          color="#ffb060"
          depthWrite={false}
          opacity={0.1}
          ref={haloMaterial}
          transparent
        />
      </instancedMesh>
      <pointLight
        color="#ffae5a"
        decay={2}
        distance={14}
        intensity={0}
        position={[hullX(0, 1) - 0.8, sheerHeight(0) + 1, 0]}
        ref={sternLight}
      />
      <pointLight
        color="#ffae5a"
        decay={2}
        distance={16}
        intensity={0}
        position={[0.5, deckY, 0]}
        ref={deckLight}
      />
    </group>
  );
}

/* ---------- the helm: a 24-spoke wheel whose rim is today's ring ---------- */

const WHEEL_RADIUS = 0.72;
export const HELM_POSITION: [number, number, number] = [-6.55, deckHeight(0.11) + 1.08, 0];

/**
 * The ship's wheel, with one spoke per hour. Today's demo sessions are inlaid around the
 * rim as arcs (midnight at the top, clockwise), lit up to the clock hand — the dashboard's
 * day ring, held by the helmsman.
 */
export function Helm({ slices }: { slices: ActivitySlice[] }) {
  const runs = useMemo(() => sliceRuns(slices, 0), [slices]);
  const spokes = useRef<InstancedMesh>(null);
  const handles = useRef<InstancedMesh>(null);
  const arcMaterials = useRef<(MeshBasicMaterial | null)[]>([]);
  const geometries = useMemo(
    () => ({
      rim: new TorusGeometry(WHEEL_RADIUS, 0.045, 8, 72),
      inner: new TorusGeometry(WHEEL_RADIUS * 0.42, 0.03, 6, 48),
      spoke: new CylinderGeometry(0.022, 0.03, WHEEL_RADIUS * 1.32, 6),
      handle: new CylinderGeometry(0.02, 0.028, 0.16, 6),
      arcs: runs.map(
        (run) =>
          new TorusGeometry(
            WHEEL_RADIUS - 0.005,
            0.03,
            5,
            24,
            ((run.end - run.start) / MINUTES_PER_DAY) * Math.PI * 2
          )
      ),
    }),
    [runs]
  );
  useEffect(
    () => () => {
      for (const geometry of [
        geometries.rim,
        geometries.inner,
        geometries.spoke,
        geometries.handle,
        ...geometries.arcs,
      ]) {
        geometry.dispose();
      }
    },
    [geometries]
  );
  useEffect(() => {
    for (let index = 0; index < 24; index += 1) {
      const angle = (index / 24) * Math.PI * 2;
      // Twelve turned spokes cross the hub, so 24 ends (one per hour) meet the rim.
      if (spokes.current && index < 12) {
        dummy.position.set(0, 0, 0);
        dummy.rotation.set(0, 0, angle);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        spokes.current.setMatrixAt(index, dummy.matrix);
      }
      if (handles.current) {
        const r = WHEEL_RADIUS + 0.12;
        dummy.position.set(Math.cos(angle + Math.PI / 2) * r, Math.sin(angle + Math.PI / 2) * r, 0);
        dummy.rotation.set(0, 0, angle);
        dummy.updateMatrix();
        handles.current.setMatrixAt(index, dummy.matrix);
      }
    }
    if (spokes.current) spokes.current.instanceMatrix.needsUpdate = true;
    if (handles.current) handles.current.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame(() => {
    for (const [index, run] of runs.entries()) {
      const material = arcMaterials.current[index];
      if (!material) continue;
      const lit = run.start < voyage.hand ? 1 : 0.22;
      material.color
        .copy(KIND_LIGHT[run.kind])
        .multiplyScalar((0.5 + 1.6 * lit) * kindWeight(run.kind));
    }
  });
  const [hx, hy, hz] = HELM_POSITION;
  return (
    <group position={[hx, hy, hz]}>
      {/* Wheel plane faces the helmsman, who stands aft looking forward (+X). */}
      <group rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={geometries.rim}>
          <meshStandardMaterial color="#5a3b22" roughness={0.55} />
        </mesh>
        <mesh geometry={geometries.inner}>
          <meshStandardMaterial color="#b08445" metalness={0.85} roughness={0.35} />
        </mesh>
        <instancedMesh args={[geometries.spoke, undefined, 12]} ref={spokes}>
          <meshStandardMaterial color="#6b4a2c" roughness={0.6} />
        </instancedMesh>
        <instancedMesh args={[geometries.handle, undefined, 24]} ref={handles}>
          <meshStandardMaterial color="#6b4a2c" roughness={0.6} />
        </instancedMesh>
        {runs.map((run, index) => (
          <mesh
            geometry={geometries.arcs[index]}
            key={`${run.start}:${run.kind}`}
            position={[0, 0, 0.05]}
            rotation={[0, 0, Math.PI / 2 + (run.start / MINUTES_PER_DAY) * Math.PI * 2]}
          >
            <meshBasicMaterial
              ref={(node) => {
                arcMaterials.current[index] = node;
              }}
            />
          </mesh>
        ))}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.22, 12]} />
          <meshStandardMaterial color="#b08445" metalness={0.85} roughness={0.35} />
        </mesh>
      </group>
      {/* The pedestal and the binnacle beside it. */}
      <mesh position={[0.05, -0.62, 0]}>
        <boxGeometry args={[0.26, 1, 0.36]} />
        <meshStandardMaterial color="#3a281a" roughness={0.75} />
      </mesh>
      <mesh position={[1.1, -0.55, 0]}>
        <cylinderGeometry args={[0.2, 0.24, 1.1, 10]} />
        <meshStandardMaterial color="#3a281a" roughness={0.75} />
      </mesh>
      <mesh position={[1.1, 0.06, 0]}>
        <sphereGeometry args={[0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#b08445" metalness={0.85} roughness={0.35} />
      </mesh>
    </group>
  );
}
