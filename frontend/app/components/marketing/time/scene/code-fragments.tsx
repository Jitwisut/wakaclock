'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef, useState } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  PlaneGeometry,
  type Points,
  type PointsMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';

import { type ActivitySlice, pointOnRing, seededRandom, SLICE_MINUTES } from '../time-data';
import { CODE_CYCLE, codeCycle, codeVisibility, snippetFor } from '../time-effects';
import { RING_RADIUS } from '../time-keyframes';
import { timeMotion } from '../time-store';

import { dotTexture } from './heartbeats';
import { SCENE } from './scene-palette';

const LINE_HEIGHT = 0.19;
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 64;
const FONT_PX = 34;

/** The page's own mono face, resolved, so the canvas draws the same letters as the HTML. */
function monoFamily() {
  const probe = document.querySelector('.tx-root .tx-kicker');
  return probe ? getComputedStyle(probe).fontFamily : 'ui-monospace, Menlo, monospace';
}

function drawLine(canvas: HTMLCanvasElement, text: string, family: string) {
  const context = canvas.getContext('2d');
  if (!context) return CANVAS_WIDTH;
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  context.font = `${FONT_PX}px ${family}`;
  context.textBaseline = 'middle';
  context.fillStyle = SCENE.ink;
  context.fillText(text, 8, CANVAS_HEIGHT / 2);
  return Math.min(CANVAS_WIDTH, Math.ceil(context.measureText(text).width) + 16);
}

interface Fragment {
  anchor: Vector3;
  canvas: HTMLCanvasElement;
  round: number;
  target: Vector3;
  texture: CanvasTexture;
  width: number;
}

/**
 * Lines of code typing themselves in the dark beside the dial during chapter 02. When a
 * line finishes, its heartbeat flies into the ring as a spark: time comes from writing.
 */
export function CodeFragments({
  count,
  dim,
  slices,
}: {
  count: number;
  /** Glow is already bright under bloom; additive light backs off there. */
  dim: boolean;
  slices: ActivitySlice[];
}) {
  const { camera } = useThree();
  const group = useRef<Group>(null);
  const meshes = useRef<(Mesh | null)[]>([]);
  const sparks = useRef<Points>(null);
  const [family, setFamily] = useState<null | string>(null);
  const today = useMemo(() => slices.filter((slice) => slice.day === 0), [slices]);
  const plane = useMemo(() => new PlaneGeometry(1, 1).translate(0.5, 0, 0), []);
  const dot = useMemo(() => dotTexture(), []);
  const ink = useMemo(() => new Color(SCENE.highlight), []);
  const sparkGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(count * 3), 3));
    return geometry;
  }, [count]);

  // Wait for the real face before drawing, or the first lines render in a fallback.
  useEffect(() => {
    const resolved = monoFamily();
    let alive = true;
    void document.fonts.load(`${FONT_PX}px ${resolved}`).finally(() => {
      if (alive) setFamily(resolved);
    });
    return () => {
      alive = false;
    };
  }, []);

  const fragments = useMemo<Fragment[]>(() => {
    if (!family) return [];
    const random = seededRandom(31);
    return Array.from({ length: count }, (_, index) => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = ClampToEdgeWrapping;
      texture.anisotropy = 4;
      const width = drawLine(canvas, snippetFor(index, 0), family);
      // Scattered around the left of the dial, nearer the camera than the ring.
      // Lines start around the left of the dial and end before its centre, clear of the
      // chapter's right-hand text.
      const anchor = new Vector3(
        -3.1 + random() * 1.4,
        -2.4 + (index / Math.max(1, count - 1)) * 4.8 + (random() - 0.5) * 0.3,
        random() * 1.2
      );
      const slice = today[Math.floor(random() * Math.max(1, today.length))];
      const [tx, ty] = pointOnRing((slice?.minute ?? 600) + SLICE_MINUTES / 2, RING_RADIUS);
      return { anchor, canvas, round: 0, target: new Vector3(tx, ty, 0), texture, width };
    });
  }, [count, family, today]);

  useEffect(
    () => () => {
      for (const fragment of fragments) fragment.texture.dispose();
    },
    [fragments]
  );

  useFrame(({ clock }) => {
    const root = group.current;
    if (!root) return;
    const visibility = codeVisibility(timeMotion.current) * (1 - timeMotion.daylight);
    root.visible = visibility > 0.01 && fragments.length > 0;
    if (!root.visible) return;
    const position = sparkGeometry.getAttribute('position') as BufferAttribute;
    const color = sparkGeometry.getAttribute('color') as BufferAttribute;
    const glow = dim ? 0.55 : 1;

    fragments.forEach((fragment, index) => {
      const time = clock.elapsedTime + (index * CODE_CYCLE) / fragments.length;
      const round = Math.floor(time / CODE_CYCLE);
      if (round !== fragment.round && family) {
        fragment.round = round;
        fragment.width = drawLine(fragment.canvas, snippetFor(index, round), family);
        fragment.texture.needsUpdate = true;
      }
      const { alpha, spark, typed } = codeCycle(time);
      const mesh = meshes.current[index];
      if (mesh) {
        const fullWidth = (fragment.width / CANVAS_HEIGHT) * LINE_HEIGHT;
        mesh.position.copy(fragment.anchor);
        mesh.quaternion.copy(camera.quaternion);
        mesh.scale.set(Math.max(0.001, fullWidth * typed), LINE_HEIGHT, 1);
        fragment.texture.repeat.set((fragment.width / CANVAS_WIDTH) * typed, 1);
        (mesh.material as MeshBasicMaterial).opacity = alpha * visibility * (dim ? 0.75 : 0.95);
      }
      // The heartbeat: from the end of the line to its slice of the ring, on an arc.
      if (spark >= 0) {
        const lift = Math.sin(spark * Math.PI) * 1.2;
        position.setXYZ(
          index,
          fragment.anchor.x + (fragment.target.x - fragment.anchor.x) * spark,
          fragment.anchor.y + (fragment.target.y - fragment.anchor.y) * spark + lift,
          fragment.anchor.z * (1 - spark)
        );
        const level = Math.sin(spark * Math.PI) * visibility * glow;
        color.setXYZ(index, ink.r * level, ink.g * level, ink.b * level);
      } else {
        color.setXYZ(index, 0, 0, 0);
      }
    });
    position.needsUpdate = true;
    color.needsUpdate = true;
    const material = sparks.current?.material as PointsMaterial | undefined;
    if (material) material.size = 0.22;
  });

  return (
    <group ref={group} visible={false}>
      {fragments.map((fragment, index) => (
        <mesh
          geometry={plane}
          key={fragment.texture.uuid}
          ref={(mesh) => {
            meshes.current[index] = mesh;
          }}
        >
          <meshBasicMaterial
            depthWrite={false}
            map={fragment.texture}
            toneMapped={false}
            transparent
          />
        </mesh>
      ))}
      <points frustumCulled={false} geometry={sparkGeometry} ref={sparks}>
        <pointsMaterial
          blending={AdditiveBlending}
          depthWrite={false}
          map={dot}
          size={0.22}
          sizeAttenuation
          toneMapped={false}
          transparent
          vertexColors
        />
      </points>
    </group>
  );
}
