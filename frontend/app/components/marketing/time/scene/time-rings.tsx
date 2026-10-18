'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  type Group,
  type InstancedMesh,
  type LineBasicMaterial,
  type Mesh,
  type MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  Vector3,
} from 'three';

import {
  type ActivitySlice,
  angleForMinute,
  MINUTES_PER_DAY,
  pointOnRing,
  SLICE_MINUTES,
  type SliceKind,
} from '../time-data';
import {
  arcLevel,
  RING_RADIUS,
  ringDepth,
  ringOpacity,
  ringTwist,
  sweepStrength,
  TRAIL_MINUTES,
  trailAt,
} from '../time-keyframes';
import { pulseShape } from '../time-midnight';
import { getTimeUi, type TimeFocus, timeMotion } from '../time-store';

import { DAY, SCENE } from './scene-palette';

const KIND_COLOR: Record<SliceKind, Color> = {
  human: new Color(SCENE.human),
  ai: new Color(SCENE.ai),
  unattributed: new Color(SCENE.unattributed),
};
const KIND_COLOR_DAY: Record<SliceKind, Color> = {
  human: new Color(DAY.human),
  ai: new Color(DAY.ai),
  unattributed: new Color(DAY.unattributed),
};
const HIGHLIGHT = new Color(SCENE.highlight);
const HIGHLIGHT_DAY = new Color(DAY.highlight);
const INK = new Color(SCENE.ink);
const INK_DAY = new Color(DAY.ink);
const glow = new Color();
const dummy = new Object3D();
const scratch = new Color();

function circleGeometry(radius: number, segments = 256) {
  const points: Vector3[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    points.push(new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
  }
  return new BufferGeometry().setFromPoints(points);
}

interface Paint {
  daylight: number;
  flash: number;
  focus: TimeFocus;
  hand: number;
  hover: number;
  sweep: number;
}

/** Per-slice colour for this frame: kind, focus, midnight flash and (today) hand and hover. */
function sliceColor(slice: ActivitySlice, paint: Paint) {
  const { daylight, flash: strike, focus, hand, hover, sweep } = paint;
  // Dusk colours lerp to the day palette once the story hands over to the light page.
  scratch.copy(KIND_COLOR[slice.kind]).lerp(KIND_COLOR_DAY[slice.kind], daylight);
  glow.copy(HIGHLIGHT).lerp(HIGHLIGHT_DAY, daylight);
  if (focus !== 'all' && focus !== slice.kind) scratch.multiplyScalar(0.16);
  if (strike > 0) scratch.lerp(glow, strike * 0.7).multiplyScalar(1 + strike);
  if (slice.day !== 0) return scratch;
  if (slice.minute === hover) return scratch.lerp(glow, 0.55).multiplyScalar(1.7);
  const middle = slice.minute + SLICE_MINUTES / 2;
  scratch.multiplyScalar(arcLevel(middle, hand));
  // The hand's passing lights each slice up briefly, stronger the faster it turns.
  const flash = trailAt(middle, hand, timeMotion.handSpeed) * sweep;
  if (flash > 0) scratch.lerp(glow, flash * 0.6).multiplyScalar(1 + flash * 0.5);
  return scratch;
}

/** One day's dial: ring, hour ticks, and its lit activity arcs (plus an additive halo). */
function DayRing({ bloom, day, slices }: { bloom: boolean; day: number; slices: ActivitySlice[] }) {
  const isToday = day === 0;
  const group = useRef<Group>(null);
  const arcs = useRef<InstancedMesh>(null);
  const halo = useRef<InstancedMesh>(null);
  const ticks = useRef<InstancedMesh>(null);
  const ring = useRef<LineBasicMaterial>(null);
  const inner = useRef<LineBasicMaterial>(null);
  const painted = useRef<null | Paint>(null);
  const drawn = useRef(false);

  const ringGeometry = useMemo(() => circleGeometry(RING_RADIUS), []);
  const innerGeometry = useMemo(() => circleGeometry(RING_RADIUS * 0.16, 96), []);
  const arcGeometry = useMemo(() => new BoxGeometry(0.075, 0.052, 0.03), []);
  const haloGeometry = useMemo(() => new PlaneGeometry(0.26, 0.06), []);
  const tickGeometry = useMemo(() => new BoxGeometry(1, 0.012, 0.012), []);
  const tickCount = isToday ? 96 : 24;

  useEffect(() => {
    const mesh = ticks.current;
    if (!mesh) return;
    for (let index = 0; index < tickCount; index += 1) {
      const minute = (index / tickCount) * MINUTES_PER_DAY;
      const major = minute % (6 * 60) === 0;
      const hour = minute % 60 === 0;
      let length = 0.08;
      if (hour) length = 0.18;
      if (major) length = 0.32;
      const [x, y] = pointOnRing(minute, RING_RADIUS + 0.14 + length / 2);
      dummy.position.set(x, y, 0);
      dummy.rotation.set(0, 0, angleForMinute(minute));
      dummy.scale.set(length, major ? 2.2 : 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [tickCount]);

  useFrame(() => {
    const g = timeMotion.current;
    const { collapse, warp } = timeMotion;
    // At midnight the week folds into today: each day becomes a lane just outside it.
    const opacity = ringOpacity(day, g) + (1 - ringOpacity(day, g)) * collapse;

    if (group.current) {
      const { spin, tilt } = ringTwist(day, g, warp);
      const settle = 1 - collapse;
      group.current.position.z = ringDepth(day, warp) * settle;
      group.current.rotation.set(tilt * settle, 0, spin * settle);
      const { throb } = pulseShape(timeMotion.pulseAge);
      group.current.scale.setScalar((1 + day * 0.045 * collapse) * (1 + throb));
    }
    const { daylight } = timeMotion;
    if (ring.current) {
      ring.current.opacity = (isToday ? 0.55 : 0.32) * opacity;
      ring.current.color.copy(INK).lerp(INK_DAY, daylight);
    }
    if (inner.current) inner.current.color.copy(INK).lerp(INK_DAY, daylight);
    if (ticks.current) {
      (ticks.current.material as MeshBasicMaterial).color.copy(INK).lerp(INK_DAY, daylight);
    }
    const layers: [InstancedMesh | null, number][] = [
      [ticks.current, 0.5],
      [arcs.current, 1],
      // Bloom already glows; the halo backs off so the two do not blow out together.
      // Additive glow vanishes on a light ground, so it fades out with the dusk.
      [halo.current, ((bloom ? 0.06 : 0.14) + warp * 0.18) * (1 - daylight)],
    ];
    for (const [mesh, base] of layers) {
      if (!mesh) continue;
      (mesh.material as MeshBasicMaterial).opacity = base * opacity;
      mesh.visible = opacity > 0.01;
    }

    const arcMesh = arcs.current;
    if (!arcMesh) return;

    // The day is already lit when the scene appears: it reads as a clock that has been
    // running all along, not one starting up as the visitor arrives.
    if (!drawn.current) {
      drawn.current = true;
      slices.forEach((slice, index) => {
        const [x, y] = pointOnRing(slice.minute + SLICE_MINUTES / 2, RING_RADIUS);
        dummy.position.set(x, y, 0);
        dummy.rotation.set(0, 0, angleForMinute(slice.minute + SLICE_MINUTES / 2));
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        arcMesh.setMatrixAt(index, dummy.matrix);
      });
      arcMesh.instanceMatrix.needsUpdate = true;
    }

    // Colours only upload when something that affects them changed.
    const ui = getTimeUi();
    const paint: Paint = {
      daylight: Math.round(daylight * 100) / 100,
      flash: Math.round(timeMotion.flash * 100) / 100,
      focus: ui.focus,
      hand: isToday ? timeMotion.hand : 0,
      hover: isToday && ui.hover ? ui.hover.minute : -1,
      sweep: isToday ? sweepStrength(timeMotion.handSpeed) : 0,
    };
    const last = painted.current;
    const idle =
      last !== null &&
      last.focus === paint.focus &&
      last.hover === paint.hover &&
      last.flash === paint.flash &&
      last.daylight === paint.daylight &&
      Math.abs(last.hand - paint.hand) < 0.5 &&
      Math.abs(last.sweep - paint.sweep) < 0.01;
    if (idle) return;
    painted.current = paint;
    slices.forEach((slice, index) => {
      arcMesh.setColorAt(index, sliceColor(slice, paint));
    });
    if (arcMesh.instanceColor) arcMesh.instanceColor.needsUpdate = true;
    // The halo shares the arcs' matrices and colours, drawn larger and additive.
    if (halo.current) {
      halo.current.instanceMatrix = arcMesh.instanceMatrix;
      halo.current.instanceColor = arcMesh.instanceColor;
    }
  });

  return (
    <group ref={group}>
      <lineLoop geometry={ringGeometry}>
        <lineBasicMaterial color={SCENE.ink} ref={ring} transparent />
      </lineLoop>
      {isToday ? (
        <lineLoop geometry={innerGeometry}>
          <lineBasicMaterial color={SCENE.ink} opacity={0.35} ref={inner} transparent />
        </lineLoop>
      ) : null}
      <instancedMesh args={[tickGeometry, undefined, tickCount]} ref={ticks}>
        <meshBasicMaterial color={SCENE.ink} transparent />
      </instancedMesh>
      <instancedMesh
        args={[arcGeometry, undefined, slices.length]}
        frustumCulled={false}
        ref={arcs}
      >
        <meshBasicMaterial toneMapped={false} transparent />
      </instancedMesh>
      <instancedMesh
        args={[haloGeometry, undefined, slices.length]}
        frustumCulled={false}
        ref={halo}
      >
        <meshBasicMaterial
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          transparent
        />
      </instancedMesh>
    </group>
  );
}

const SWEEP_ANGLE = (TRAIL_MINUTES / MINUTES_PER_DAY) * Math.PI * 2;

/**
 * A fan of light behind the hand: bright at the hand, fading to nothing TRAIL_MINUTES behind.
 * The fan opens counter-clockwise from angle 0, which is "behind" a clockwise hand.
 */
function useSweepGeometry() {
  return useMemo(() => {
    const geometry = new RingGeometry(0.34, RING_RADIUS + 0.06, 48, 1, 0, SWEEP_ANGLE);
    const position = geometry.getAttribute('position') as BufferAttribute;
    const colors = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index += 1) {
      const angle = Math.atan2(position.getY(index), position.getX(index));
      const level = (1 - Math.min(1, Math.max(0, angle / SWEEP_ANGLE))) ** 2;
      colors[index * 3] = HIGHLIGHT.r * level;
      colors[index * 3 + 1] = HIGHLIGHT.g * level;
      colors[index * 3 + 2] = HIGHLIGHT.b * level;
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    return geometry;
  }, []);
}

/**
 * The hand on today's dial. Its angle is the scroll (08:00 at the top of the page); the
 * light sweep's strength follows how fast it turns, so it vanishes when scrolling stops and
 * swings to the other side when the visitor scrolls back up.
 */
function ClockHand() {
  const hand = useRef<Group>(null);
  const handMaterial = useRef<MeshBasicMaterial>(null);
  const hubMaterial = useRef<MeshBasicMaterial>(null);
  const sweep = useRef<Mesh>(null);
  const sweepGeometry = useSweepGeometry();
  // Pivot at the centre: the box extends outward from the hub.
  const geometry = useMemo(() => {
    const length = RING_RADIUS - 0.2;
    return new BoxGeometry(length, 0.016, 0.016).translate(length / 2, 0, 0);
  }, []);

  useFrame(() => {
    const angle = angleForMinute(timeMotion.hand);
    if (hand.current) hand.current.rotation.z = angle;
    const mesh = sweep.current;
    if (!mesh) return;
    glow.copy(HIGHLIGHT).lerp(HIGHLIGHT_DAY, timeMotion.daylight);
    handMaterial.current?.color.copy(glow);
    hubMaterial.current?.color.copy(glow);
    const strength = sweepStrength(timeMotion.handSpeed) * (1 - timeMotion.daylight);
    mesh.visible = strength > 0.01;
    (mesh.material as MeshBasicMaterial).opacity = strength * 0.3;
    // Mirroring across the hand (flip about its own axis) puts the fan on the other side.
    if (timeMotion.handSpeed >= 0) {
      mesh.rotation.set(0, 0, angle);
    } else {
      mesh.rotation.set(Math.PI, 0, -angle);
    }
  });

  return (
    <group>
      <mesh geometry={sweepGeometry} position={[0, 0, -0.01]} ref={sweep}>
        <meshBasicMaterial
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
          toneMapped={false}
          transparent
          vertexColors
        />
      </mesh>
      <group ref={hand}>
        <mesh geometry={geometry}>
          <meshBasicMaterial color={SCENE.highlight} ref={handMaterial} toneMapped={false} />
        </mesh>
      </group>
      <mesh>
        <circleGeometry args={[0.06, 32]} />
        <meshBasicMaterial color={SCENE.highlight} ref={hubMaterial} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function TimeRings({
  bloom,
  days,
  slices,
}: {
  bloom: boolean;
  days: number;
  slices: ActivitySlice[];
}) {
  const byDay = useMemo(
    () =>
      Array.from({ length: days }, (_, day) => ({
        day,
        slices: slices.filter((slice) => slice.day === day),
      })),
    [days, slices]
  );

  return (
    <group>
      {byDay.map((entry) => (
        <DayRing bloom={bloom} day={entry.day} key={entry.day} slices={entry.slices} />
      ))}
      <ClockHand />
    </group>
  );
}
