'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import * as React from 'react';

import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import type { TimeCoreArc, TimeCoreModel } from '@/lib/wakaclock/time-core';

import { RING_BASE_RADIUS, RING_SPACING } from './time-core-geometry';

/*
 * The Time Core in WebGL. Rendering only: every number comes from the TimeCoreModel the
 * parent built from GET /durations. The dial lies flat; midnight is the far edge (-Z) and
 * the day runs clockwise seen from above. Each project is a ring, each session an arc.
 *
 * "Explode" lifts the rings apart (an exploded assembly) and labels each layer. The camera
 * settles in on first paint, idles in a slow orbit only while `active` (on screen, tab
 * visible, motion allowed), and otherwise renders on demand.
 */

const RING_WIDTH = 0.15;
const RING_HEIGHT = 0.075;
const EXPLODE_GAP = 0.42;
const MIN_ARC = (0.7 * Math.PI) / 180;
const DIAL_RADIUS = RING_BASE_RADIUS + RING_SPACING * 6 + 0.18;

const STAGE = {
  ai: '#3ccf8e',
  dust: '#c9d3de',
  human: '#efe9dc',
  line: '#3a4350',
  overlap: '#8fa6bf',
  tick: '#7d8794',
};

export type TimeCoreSceneProps = {
  active: boolean;
  exploded: boolean;
  focusedRing: null | number;
  model: TimeCoreModel;
  onHover: (arc: null | TimeCoreArc) => void;
  onSelect: (arc: TimeCoreArc) => void;
  /** Element holding the `data-anchor` labels the scene positions. */
  overlay: React.RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
  selectedArcId: null | string;
};

function ringRadius(index: number) {
  return RING_BASE_RADIUS + index * RING_SPACING;
}

/** An annular sector extruded upwards, laid flat on the dial. */
function arcGeometry(inner: number, outer: number, start: number, end: number) {
  const sweep = Math.max(MIN_ARC, end - start);
  const steps = Math.max(2, Math.ceil((sweep / (Math.PI * 2)) * 96));
  const shape = new THREE.Shape();
  for (let i = 0; i <= steps; i += 1) {
    const angle = start + (sweep * i) / steps;
    const point = [Math.sin(angle) * outer, Math.cos(angle) * outer] as const;
    if (i === 0) shape.moveTo(...point);
    else shape.lineTo(...point);
  }
  for (let i = steps; i >= 0; i -= 1) {
    const angle = start + (sweep * i) / steps;
    shape.lineTo(Math.sin(angle) * inner, Math.cos(angle) * inner);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth: RING_HEIGHT,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function easeOut(t: number) {
  return 1 - (1 - t) ** 3;
}

function Arc({
  arc,
  color,
  dimmed,
  index,
  onHover,
  onSelect,
  reducedMotion,
  selected,
}: {
  arc: TimeCoreArc;
  color: string;
  dimmed: boolean;
  index: number;
  onHover: TimeCoreSceneProps['onHover'];
  onSelect: TimeCoreSceneProps['onSelect'];
  reducedMotion: boolean;
  selected: boolean;
}) {
  const radius = ringRadius(index);
  const geometry = React.useMemo(
    () =>
      arcGeometry(radius - RING_WIDTH / 2, radius + RING_WIDTH / 2, arc.startAngle, arc.endAngle),
    [arc.endAngle, arc.startAngle, radius]
  );
  React.useEffect(() => () => geometry.dispose(), [geometry]);
  const [hovered, setHovered] = React.useState(false);
  const mesh = React.useRef<THREE.Mesh>(null);
  // Seconds of rendered time since mount, from frame deltas: the intro plays over frames
  // actually drawn, so an on-demand canvas never skips straight to the end of it.
  const elapsed = React.useRef(0);

  useFrame((_, delta) => {
    const target = mesh.current;
    if (!target) return;
    elapsed.current += delta;
    const age = reducedMotion ? 1 : (elapsed.current - index * 0.08) / 0.9;
    const grow = easeOut(Math.min(1, Math.max(0, age)));
    target.scale.set(1, Math.max(0.001, grow), 1);
    const lift = selected || hovered ? 0.07 : 0;
    target.position.y += (lift - target.position.y) * (reducedMotion ? 1 : 0.18);
  });

  return (
    <mesh
      geometry={geometry}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(arc);
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(null);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        onHover(arc);
      }}
      ref={mesh}
    >
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={selected || hovered ? 0.55 : 0.12}
        metalness={0.15}
        opacity={dimmed ? 0.22 : 1}
        roughness={0.42}
        transparent={dimmed}
      />
    </mesh>
  );
}

/** Ring layer: lifts to its exploded height; registers itself so its label can follow. */
function RingLayer({
  children,
  exploded,
  index,
  reducedMotion,
  rings,
}: {
  children: React.ReactNode;
  exploded: boolean;
  index: number;
  reducedMotion: boolean;
  rings: React.RefObject<(null | THREE.Group)[]>;
}) {
  const group = React.useRef<THREE.Group>(null);
  React.useLayoutEffect(() => {
    const registry = rings.current;
    registry[index] = group.current;
    return () => {
      registry[index] = null;
    };
  }, [index, rings]);
  const target = exploded ? (index + 1) * EXPLODE_GAP : 0;
  useFrame(() => {
    const node = group.current;
    if (!node) return;
    node.position.y += (target - node.position.y) * (reducedMotion ? 1 : 0.09);
  });
  const radius = ringRadius(index);
  return (
    <group ref={group}>
      {/* The ring's track: a faint full circle so empty hours still read as time. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.006, radius + 0.006, 128]} />
        <meshBasicMaterial color={STAGE.line} opacity={0.9} transparent />
      </mesh>
      {children}
    </group>
  );
}

/** 24 hour ticks around the dial; every sixth one is long. */
function HourTicks() {
  const mesh = React.useRef<THREE.InstancedMesh>(null);
  React.useLayoutEffect(() => {
    const node = mesh.current;
    if (!node) return;
    const dummy = new THREE.Object3D();
    for (let hour = 0; hour < 24; hour += 1) {
      const angle = (hour / 24) * Math.PI * 2;
      const major = hour % 6 === 0;
      const length = major ? 0.26 : 0.11;
      const r = DIAL_RADIUS + length / 2;
      dummy.position.set(Math.sin(angle) * r, 0, -Math.cos(angle) * r);
      dummy.rotation.set(0, -angle, 0);
      dummy.scale.set(major ? 0.022 : 0.012, 0.012, length);
      dummy.updateMatrix();
      node.setMatrixAt(hour, dummy.matrix);
    }
    node.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh args={[undefined, undefined, 24]} ref={mesh}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={STAGE.tick} />
    </instancedMesh>
  );
}

const HOUR_LABEL_RADIUS = DIAL_RADIUS + 0.55;

/**
 * Positions the DOM labels in `overlay` (hour marks, and ring names when exploded) over
 * their 3D anchors each rendered frame. Plain DOM rather than drei <Html>: those mount a
 * React root per label, which React 19 cannot unmount mid-render when the day changes.
 */
function LabelProjector({
  overlay,
  rings,
}: {
  overlay: React.RefObject<HTMLDivElement | null>;
  rings: React.RefObject<(null | THREE.Group)[]>;
}) {
  const { camera, size } = useThree();
  const point = React.useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const root = overlay.current;
    if (!root) return;
    for (const element of root.querySelectorAll<HTMLElement>('[data-anchor]')) {
      const [kind, raw] = (element.dataset.anchor ?? '').split(':');
      const value = Number(raw);
      if (kind === 'hour') {
        const angle = (value / 24) * Math.PI * 2;
        point.set(Math.sin(angle) * HOUR_LABEL_RADIUS, -0.35, -Math.cos(angle) * HOUR_LABEL_RADIUS);
      } else {
        const group = rings.current[value];
        if (!group) {
          element.style.opacity = '0';
          continue;
        }
        point.set(ringRadius(value) + 0.1, group.position.y - 0.35 + RING_HEIGHT, 0);
      }
      point.project(camera);
      const x = (point.x * 0.5 + 0.5) * size.width;
      const y = (-point.y * 0.5 + 0.5) * size.height;
      element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      element.style.opacity = point.z < 1 ? '1' : '0';
    }
  });
  return null;
}

/**
 * The spindle at the centre. With a measured human/AI split it is three stacked
 * segments (human only, both, AI only) whose heights are proportional to the seconds;
 * without one it is a single neutral spindle — no split is drawn that was not measured.
 */
function CoreSpindle({ model, reducedMotion }: { model: TimeCoreModel; reducedMotion: boolean }) {
  const group = React.useRef<THREE.Group>(null);
  const elapsed = React.useRef(0);
  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    elapsed.current += delta;
    const t = reducedMotion ? 1 : easeOut(Math.min(1, elapsed.current / 1.4));
    node.scale.set(1, Math.max(0.001, t), 1);
  });

  const maxHeight = 1.15;
  const { attribution } = model;
  const parts = attribution
    ? [
        { color: STAGE.human, seconds: attribution.humanOnlySeconds },
        { color: STAGE.overlap, seconds: attribution.overlapSeconds },
        { color: STAGE.ai, seconds: attribution.aiOnlySeconds },
      ]
    : [{ color: STAGE.human, seconds: model.totalSeconds }];
  const sum = parts.reduce((total, part) => total + part.seconds, 0);
  // Height reads the day against an 8-hour reference, capped so a long day stays on stage.
  const height = Math.min(maxHeight, (sum / (8 * 3600)) * maxHeight) || 0.02;
  let base = 0;

  return (
    <group ref={group}>
      {parts.map((part) => {
        const h = sum > 0 ? (part.seconds / sum) * height : 0;
        const y = base + h / 2;
        base += h;
        if (h <= 0) return null;
        return (
          <mesh key={part.color} position={[0, y, 0]}>
            <cylinderGeometry args={[0.2, 0.2, h, 48]} />
            <meshStandardMaterial color={part.color} metalness={0.1} roughness={0.5} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.315, 64]} />
        <meshBasicMaterial color={STAGE.tick} />
      </mesh>
    </group>
  );
}

/** Sparse drifting dust that gives the stage depth; static under reduced motion. */
function Dust({ count, reducedMotion }: { count: number; reducedMotion: boolean }) {
  const points = React.useRef<THREE.Points>(null);
  const positions = React.useMemo(() => {
    const array = new Float32Array(count * 3);
    let seed = 7;
    const random = () => {
      seed = (seed * 16_807) % 2_147_483_647;
      return seed / 2_147_483_647;
    };
    for (let i = 0; i < count; i += 1) {
      const r = 1.2 + random() * 4.2;
      const a = random() * Math.PI * 2;
      array[i * 3] = Math.sin(a) * r;
      array[i * 3 + 1] = -0.6 + random() * 3.2;
      array[i * 3 + 2] = Math.cos(a) * r;
    }
    return array;
  }, [count]);
  useFrame((_, delta) => {
    if (reducedMotion || !points.current) return;
    points.current.rotation.y += delta * 0.012;
  });
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute args={[positions, 3]} attach="attributes-position" />
      </bufferGeometry>
      <pointsMaterial color={STAGE.dust} opacity={0.35} size={0.018} sizeAttenuation transparent />
    </points>
  );
}

/** Establishing shot: the camera starts wide and low, then settles. */
function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera } = useThree();
  const settled = React.useRef(reducedMotion);
  const elapsed = React.useRef(0);
  const from = React.useMemo(() => new THREE.Vector3(0, 2.4, 10.5), []);
  const to = React.useMemo(() => new THREE.Vector3(0, 4.2, 7.6), []);
  React.useLayoutEffect(() => {
    camera.position.copy(reducedMotion ? to : from);
    camera.lookAt(0, -0.45, 0);
  }, [camera, from, reducedMotion, to]);
  useFrame((_, delta) => {
    if (settled.current) return;
    elapsed.current += delta;
    const t = Math.min(1, elapsed.current / 1.8);
    camera.position.lerpVectors(from, to, easeOut(t));
    camera.lookAt(0, -0.45, 0);
    if (t >= 1) settled.current = true;
  });
  return null;
}

/** Everything inside the canvas: dial, rings, spindle, dust, camera and labels. */
export function TimeCoreWorld({
  compact,
  exploded,
  focusedRing,
  model,
  onHover,
  onSelect,
  overlay,
  reducedMotion,
  selectedArcId,
}: { compact: boolean } & Omit<TimeCoreSceneProps, 'active'>) {
  const ringGroups = React.useRef<(null | THREE.Group)[]>([]);
  return (
    <>
      <CameraRig reducedMotion={reducedMotion} />
      <ambientLight intensity={0.45} />
      <directionalLight color="#fff3df" intensity={1.6} position={[-4, 6, 3]} />
      <directionalLight color="#7d97b3" intensity={0.9} position={[4, 2, -5]} />
      <group position={[0, -0.35, 0]}>
        <mesh position={[0, -0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[DIAL_RADIUS + 0.02, 128]} />
          <meshStandardMaterial color="#12161c" metalness={0.2} roughness={0.9} />
        </mesh>
        <HourTicks />
        {model.rings.map((ring, index) => (
          <RingLayer
            exploded={exploded}
            index={index}
            key={ring.label}
            reducedMotion={reducedMotion}
            rings={ringGroups}
          >
            {ring.arcs.map((arc) => (
              <Arc
                arc={arc}
                color={ring.color}
                dimmed={focusedRing !== null && focusedRing !== index}
                index={index}
                key={arc.id}
                onHover={onHover}
                onSelect={onSelect}
                reducedMotion={reducedMotion}
                selected={selectedArcId === arc.id}
              />
            ))}
          </RingLayer>
        ))}
        <CoreSpindle model={model} reducedMotion={reducedMotion} />
        <Dust count={compact ? 70 : 200} reducedMotion={reducedMotion} />
      </group>
      <LabelProjector overlay={overlay} rings={ringGroups} />
    </>
  );
}

export default function TimeCoreScene({ active, ...props }: TimeCoreSceneProps) {
  const [compact, setCompact] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return (
    <Canvas
      camera={{ far: 60, fov: 36, near: 0.1, position: [0, 4.2, 7.6] }}
      dpr={compact ? [1, 1.5] : [1, 1.75]}
      frameloop={active ? 'always' : 'demand'}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      onPointerMissed={() => props.onHover(null)}
    >
      <TimeCoreWorld compact={compact} {...props} />
      <OrbitControls
        autoRotate={active && !props.reducedMotion}
        autoRotateSpeed={0.35}
        enableDamping
        enablePan={false}
        enableZoom={false}
        maxPolarAngle={1.2}
        minPolarAngle={0.3}
        target={[0, -0.45, 0]}
      />
    </Canvas>
  );
}
