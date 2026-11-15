'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import {
  ExtrudeGeometry,
  type InstancedMesh,
  type Mesh,
  MeshStandardMaterial,
  Object3D,
  Shape,
} from 'three';

import { voyage } from '../voyage/state';

import { lineAtTour, lineY, lineZ } from './file-plan';
import { registerPick } from './pick';
import { collectHeart, heartReached, HEARTS, play } from './play';

/**
 * Heartbeats to collect (owner decision 2026-11-15): little hearts floating over the file,
 * which the developer picks up in passing, and one hidden on every island, which the visitor
 * taps. Collected ones pop and vanish; the count shows beside the demo clock.
 */

export const HEART_COLOUR = '#d98a78';

function heartShape() {
  const shape = new Shape();
  shape.moveTo(0, -1);
  shape.bezierCurveTo(-0.25, -0.62, -1.4, -0.2, -1.22, 0.52);
  shape.bezierCurveTo(-1.02, 1.22, -0.22, 1.24, 0, 0.62);
  shape.bezierCurveTo(0.22, 1.24, 1.02, 1.22, 1.22, 0.52);
  shape.bezierCurveTo(1.4, -0.2, 0.25, -0.62, 0, -1);
  return shape;
}

/** One heart's geometry, centred, about 1.2 m across. */
function heartGeometry() {
  const geometry = new ExtrudeGeometry(heartShape(), {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.14,
    bevelThickness: 0.16,
    curveSegments: 14,
    depth: 0.34,
  });
  geometry.center();
  geometry.scale(0.55, 0.55, 0.55);
  return geometry;
}

function useHeartParts() {
  const parts = useMemo(
    () => ({
      geometry: heartGeometry(),
      material: new MeshStandardMaterial({
        color: HEART_COLOUR,
        emissive: HEART_COLOUR,
        emissiveIntensity: 0.18,
        roughness: 0.45,
      }),
    }),
    []
  );
  useEffect(
    () => () => {
      parts.geometry.dispose();
      parts.material.dispose();
    },
    [parts]
  );
  return parts;
}

/** How big a heart is `age` seconds after being collected: a pop, then gone. */
export function popScale(age: number) {
  if (age < 0) return 1;
  if (age < 0.18) return 1 + (age / 0.18) * 0.7;
  return Math.max(0, 1.7 * (1 - (age - 0.18) / 0.32));
}

const dummy = new Object3D();
const ROUTE = HEARTS.filter((heart) => heart.stop === 0);

/** The hearts over the file, collected as the developer's cursor reaches their line. */
export function RouteHearts() {
  const mesh = useRef<InstancedMesh>(null);
  const { geometry, material } = useHeartParts();
  const popped = useRef(new Map<number, number>());
  useFrame(() => {
    const instance = mesh.current;
    if (!instance) return;
    const reached = lineAtTour(voyage.reached);
    for (const [index, heart] of ROUTE.entries()) {
      if (heartReached(heart, reached) && collectHeart(heart.id)) {
        popped.current.set(heart.id, voyage.time);
      }
      // A new day puts them all back.
      if (!play.hearts.has(heart.id)) popped.current.delete(heart.id);
      const since = popped.current.get(heart.id);
      const age = since === undefined ? -1 : voyage.time - since;
      const gone = play.hearts.has(heart.id) && since === undefined;
      const scale = gone ? 0 : popScale(age);
      dummy.position.set(
        heart.x,
        lineY(heart.line) + 3.2 + Math.sin(voyage.time * 2 + index) * 0.25 + Math.max(0, age) * 4,
        lineZ(heart.line)
      );
      dummy.rotation.set(0, voyage.time * 1.4 + index, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      instance.setMatrixAt(index, dummy.matrix);
    }
    instance.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      args={[geometry, material, ROUTE.length]}
      castShadow
      frustumCulled={false}
      ref={mesh}
    />
  );
}

/** The heart hidden on an island: tap it to collect it. */
export function IslandHeart({ stop }: { stop: number }) {
  const heart = useMemo(() => HEARTS.find((entry) => entry.stop === stop), [stop]);
  const mesh = useRef<Mesh>(null);
  const { geometry, material } = useHeartParts();
  const popped = useRef<null | number>(null);
  useEffect(() => {
    const object = mesh.current;
    if (!object || !heart) return;
    return registerPick(object, () => {
      if (collectHeart(heart.id)) popped.current = voyage.time;
    });
  }, [heart]);
  useFrame(() => {
    const object = mesh.current;
    if (!object || !heart) return;
    if (!play.hearts.has(heart.id)) popped.current = null;
    const collected = play.hearts.has(heart.id);
    const age = popped.current === null ? -1 : voyage.time - popped.current;
    const scale = collected && popped.current === null ? 0 : popScale(age);
    object.visible = scale > 0.001;
    object.scale.setScalar(scale);
    object.rotation.y = voyage.time * 1.2 + stop;
    object.position.y = 5.4 + Math.sin(voyage.time * 1.8 + stop) * 0.3 + Math.max(0, age) * 4;
  });
  if (!heart) return null;
  return (
    <mesh
      castShadow
      geometry={geometry}
      material={material}
      position={[-8.2, 5.4, 3.4]}
      ref={mesh}
    />
  );
}
