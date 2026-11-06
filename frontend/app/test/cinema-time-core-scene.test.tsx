import { useThree } from '@react-three/fiber';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { TimeCoreWorld } from '@/components/wakaclock/time-core/time-core-scene';
import { buildTimeCore, type TimeCoreModel } from '@/lib/wakaclock/time-core';

import type { DurationBlock, DurationsResponse } from '@/lib/wakaclock/types';

/*
 * The Time Core's WebGL world, rendered by @react-three/test-renderer (no GPU). Frames are
 * advanced by hand so the intro, the exploded assembly and the label projector run.
 */

const START = 1_793_984_400;

function block(project: string, hour: number, minutes: number): DurationBlock {
  const start = START + hour * 3600;
  return {
    category: 'coding',
    duration_seconds: minutes * 60,
    end: start + minutes * 60,
    entity: project,
    heartbeat_count: 1,
    language: null,
    project,
    start,
  };
}

function model(extra: Partial<DurationsResponse> = {}): TimeCoreModel {
  return buildTimeCore({
    data: [block('web', 9, 60), block('web', 14, 30), block('api', 11, 45)],
    date: '2026-11-06',
    range_end: START + 86_400,
    range_start: START,
    total: 3,
    ...extra,
  });
}

function overlayWith(anchors: string[]) {
  const root = document.createElement('div');
  for (const anchor of anchors) {
    const span = document.createElement('span');
    span.dataset.anchor = anchor;
    root.append(span);
  }
  return { current: root };
}

async function mount(props: Partial<Parameters<typeof TimeCoreWorld>[0]> = {}) {
  const handlers = { onHover: vi.fn(), onSelect: vi.fn() };
  const overlay = overlayWith(['hour:0', 'hour:6', 'ring:0', 'ring:1', 'ring:7']);
  const renderer = await ReactThreeTestRenderer.create(
    <TimeCoreWorld
      compact={false}
      exploded={false}
      focusedRing={null}
      model={model()}
      overlay={overlay}
      reducedMotion={false}
      selectedArcId={null}
      {...handlers}
      {...props}
    />
  );
  return { ...handlers, overlay, renderer };
}

const arcMeshes = (renderer: Awaited<ReturnType<typeof mount>>['renderer']) =>
  renderer.scene.findAll(
    (node) =>
      node.type === 'Mesh' &&
      (node.instance as THREE.Mesh).geometry instanceof THREE.ExtrudeGeometry
  );

describe('TimeCoreWorld', () => {
  it('draws one extruded arc per session and grows them in on the first frames', async () => {
    const { renderer } = await mount();
    const arcs = arcMeshes(renderer);
    expect(arcs).toHaveLength(3);
    await renderer.advanceFrames(1, 0.016);
    const start = arcs[0].instance.scale.y;
    await renderer.advanceFrames(90, 0.05);
    expect(arcs[0].instance.scale.y).toBeGreaterThan(start);
    expect(
      renderer.scene.findAll((node) => node.instance instanceof THREE.InstancedMesh)
    ).toHaveLength(1);
    expect(renderer.scene.findAll((node) => node.instance instanceof THREE.Points)).toHaveLength(1);
  });

  it('reports hover, leave and select for a session arc', async () => {
    const { onHover, onSelect, renderer } = await mount();
    const [first] = arcMeshes(renderer);
    await renderer.fireEvent(first, 'onPointerOver');
    expect(onHover).toHaveBeenLastCalledWith(expect.objectContaining({ project: 'web' }));
    await renderer.advanceFrames(20, 0.05);
    expect(first.instance.position.y).toBeGreaterThan(0);
    await renderer.fireEvent(first, 'onPointerOut');
    expect(onHover).toHaveBeenLastCalledWith(null);
    await renderer.fireEvent(first, 'onClick');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ project: 'web' }));
  });

  it('lifts the rings apart when exploded and projects their labels', async () => {
    const { overlay, renderer } = await mount({ exploded: true });
    await renderer.advanceFrames(80, 0.05);
    const rings = renderer.scene.findAll(
      (node) =>
        node.type === 'Group' &&
        node.children.some(
          (child) =>
            child.type === 'Mesh' &&
            (child.instance as THREE.Mesh).geometry instanceof THREE.RingGeometry
        ) &&
        node.instance.position.y > 0.3
    );
    expect(rings.length).toBe(2);
    const spans = overlay.current.querySelectorAll<HTMLElement>('[data-anchor]');
    expect(spans[0].style.transform).toMatch(/^translate3d\(/);
    expect(spans[2].style.transform).toMatch(/^translate3d\(/);
    // An anchor for a ring that does not exist stays hidden.
    expect(spans[4].style.opacity).toBe('0');
  });

  it('settles instantly under reduced motion and dims rings outside the focus', async () => {
    const { renderer } = await mount({
      exploded: true,
      focusedRing: 1,
      reducedMotion: true,
      selectedArcId: 'web-0',
    });
    await renderer.advanceFrames(2, 0.016);
    const arcs = arcMeshes(renderer);
    expect(arcs.every((arc) => arc.instance.scale.y === 1)).toBe(true);
    const materials = arcs.map(
      (arc) => (arc.instance as THREE.Mesh).material as THREE.MeshStandardMaterial
    );
    expect(materials.filter((material) => material.transparent)).toHaveLength(2);
    expect(materials.some((material) => material.emissiveIntensity > 0.5)).toBe(true);
  });

  it('splits the spindle into human, both and AI only when measured', async () => {
    const cylinders = (renderer: Awaited<ReturnType<typeof mount>>['renderer']) =>
      renderer.scene.findAll(
        (node) =>
          node.type === 'Mesh' &&
          (node.instance as THREE.Mesh).geometry instanceof THREE.CylinderGeometry
      );
    const measured = await mount({
      model: model({
        active_ai_only_seconds: 600,
        active_coverage: 'measured',
        active_human_only_seconds: 1200,
        active_overlap_seconds: 0,
      }),
    });
    expect(cylinders(measured.renderer)).toHaveLength(2);
    const plain = await mount({ compact: true });
    expect(cylinders(plain.renderer)).toHaveLength(1);
    const empty = await mount({ model: model({ data: [] }) });
    expect(cylinders(empty.renderer)).toHaveLength(0);
  });

  it('moves the camera from its establishing shot to the settled framing', async () => {
    const seen: { camera: null | THREE.Camera } = { camera: null };
    function Probe() {
      seen.camera = useThree((state) => state.camera);
      return null;
    }
    const overlay = overlayWith([]);
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <TimeCoreWorld
          compact={false}
          exploded={false}
          focusedRing={null}
          model={model()}
          onHover={vi.fn()}
          onSelect={vi.fn()}
          overlay={overlay}
          reducedMotion={false}
          selectedArcId={null}
        />
        <Probe />
      </>
    );
    await renderer.advanceFrames(1, 0.016);
    const early = seen.camera!.position.z;
    await renderer.advanceFrames(80, 0.05);
    expect(seen.camera!.position.z).toBeLessThan(early);
    await renderer.unmount();
  });
});
