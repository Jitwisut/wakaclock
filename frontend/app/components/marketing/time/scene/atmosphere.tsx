'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  CanvasTexture,
  type Group,
  type MeshBasicMaterial,
  PMREMGenerator,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { timeMotion } from '../time-store';

import { awakening } from './core';
import { dotTexture } from './heartbeats';
import { SCENE } from './scene-palette';

/**
 * Image-based lighting for the metal, generated locally from three's RoomEnvironment —
 * nothing is downloaded. Kept dim: reflections give the machinery its shape, the scene
 * lights give it its colour.
 */
function LocalEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.35;
    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
      room.traverse((child) => {
        const mesh = child as {
          geometry?: { dispose: () => void };
          material?: { dispose: () => void };
        };
        mesh.geometry?.dispose();
        mesh.material?.dispose();
      });
    };
  }, [gl, scene]);
  return null;
}

/** A soft vertical beam: transparent at both ends, brightest a third of the way down. */
function shaftTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context) {
    const vertical = context.createLinearGradient(0, 0, 0, 256);
    vertical.addColorStop(0, 'rgba(255,255,255,0)');
    vertical.addColorStop(0.35, 'rgba(255,255,255,1)');
    vertical.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = vertical;
    context.fillRect(0, 0, 64, 256);
    context.globalCompositeOperation = 'destination-in';
    const horizontal = context.createLinearGradient(0, 0, 64, 0);
    horizontal.addColorStop(0, 'rgba(0,0,0,0)');
    horizontal.addColorStop(0.5, 'rgba(0,0,0,1)');
    horizontal.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = horizontal;
    context.fillRect(0, 0, 64, 256);
  }
  return new CanvasTexture(canvas);
}

const SHAFTS = [
  {
    position: [-3.5, 6, -6],
    rotation: [0, 0, 0.42],
    scale: [3.2, 26, 1],
    color: SCENE.human,
    base: 0.07,
  },
  {
    position: [1.5, 7, -9],
    rotation: [0, 0, 0.3],
    scale: [5.5, 30, 1],
    color: SCENE.human,
    base: 0.045,
  },
  {
    position: [6, 4, -4],
    rotation: [0, 0, -0.5],
    scale: [2.4, 22, 1],
    color: SCENE.ai,
    base: 0.05,
  },
] as const;

/** Volumetric light falling through the haze onto the core from above. */
function LightShafts() {
  const texture = useMemo(() => shaftTexture(), []);
  const materials = useRef<(MeshBasicMaterial | null)[]>([]);
  const group = useRef<Group>(null);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(({ camera, clock }) => {
    const { lines } = awakening(timeMotion.wake);
    // Shafts belong to the core's chamber: they fade as the camera travels into the tunnel.
    const near = Math.max(0, Math.min(1, (camera.position.z + 12) / 10));
    for (const [index, shaft] of SHAFTS.entries()) {
      const material = materials.current[index];
      if (!material) continue;
      const drift = 0.75 + Math.sin(clock.elapsedTime * 0.25 + index * 2.1) * 0.25;
      material.opacity = shaft.base * lines * drift * near;
    }
    // Billboard around the vertical axis only, so beams always read as beams.
    if (group.current) {
      group.current.rotation.y = Math.atan2(camera.position.x, camera.position.z) * 0.6;
    }
  });
  return (
    <group ref={group}>
      {SHAFTS.map((shaft, index) => (
        <mesh
          key={shaft.position.join(',')}
          position={shaft.position as unknown as [number, number, number]}
          rotation={shaft.rotation as unknown as [number, number, number]}
          scale={shaft.scale as unknown as [number, number, number]}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color={shaft.color}
            depthWrite={false}
            map={texture}
            opacity={0}
            ref={(node) => {
              materials.current[index] = node;
            }}
            toneMapped={false}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

/** Distant glows that give the void its depth: cyan behind the core, amber far off-axis. */
function Nebula() {
  const dot = useMemo(() => dotTexture(), []);
  useEffect(() => () => dot.dispose(), [dot]);
  return (
    <>
      <sprite position={[0, 0, -14]} scale={[34, 34, 1]}>
        <spriteMaterial
          blending={AdditiveBlending}
          color={SCENE.human}
          depthWrite={false}
          map={dot}
          opacity={0.05}
          toneMapped={false}
          transparent
        />
      </sprite>
      <sprite position={[22, 10, -30]} scale={[40, 40, 1]}>
        <spriteMaterial
          blending={AdditiveBlending}
          color={SCENE.ai}
          depthWrite={false}
          map={dot}
          opacity={0.035}
          toneMapped={false}
          transparent
        />
      </sprite>
    </>
  );
}

/**
 * The lighting rig: one cool key from above-left, a warm amber rim from behind, a whisper of
 * ambient, plus the nucleus' own point light (in core.tsx). Cyan and amber are light
 * sources here, never fills.
 */
export function Atmosphere({ shafts }: { shafts: boolean }) {
  return (
    <>
      <LocalEnvironment />
      <ambientLight color="#8fa3b8" intensity={0.12} />
      <directionalLight color="#dfe8f2" intensity={0.9} position={[-8, 9, 7]} />
      <directionalLight color={SCENE.ai} intensity={1.6} position={[9, -3, -10]} />
      <directionalLight color={SCENE.human} intensity={0.35} position={[2, -8, 4]} />
      <Nebula />
      {shafts ? <LightShafts /> : null}
    </>
  );
}
