'use client';

import { useEffect } from 'react';

import { useThree } from '@react-three/fiber';
import { type Intersection, type Object3D, Raycaster, Vector2 } from 'three';

/**
 * Tapping things in the model (owner decision 2026-11-15). The canvas sits under the page's
 * layers (the hero copy, the veils, the reading panel), so it never sees a click itself.
 * Instead a click anywhere that is not on the page's own content or controls is cast as a
 * ray into the scene, and the nearest registered object under it reacts.
 */

export type PickHandler = (hit: Intersection, event: MouseEvent) => void;

const pickables = new Map<Object3D, PickHandler>();

/** Makes an object tappable; returns the function that undoes it. */
export function registerPick(object: Object3D, handler: PickHandler) {
  pickables.set(object, handler);
  return () => {
    pickables.delete(object);
  };
}

/** What a click on the page lands on: the page's content and controls keep their clicks. */
export function clickIsForScene(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (target.closest('a, button, input, select, textarea, label, summary, header, nav, dialog')) {
    return false;
  }
  if (target.closest('[data-world-place][data-world-open], .tx-story, .tx-world-card')) {
    return false;
  }
  // Text the visitor might be selecting or reading.
  if (target.closest('h1, h2, h3, h4, p, li, span, figure, table, code, pre')) return false;
  return true;
}

const ray = new Raycaster();
const pointer = new Vector2();

export function ScenePicker() {
  const { camera, gl } = useThree();
  useEffect(() => {
    const cast = (event: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      ray.setFromCamera(pointer, camera);
      const hits = ray.intersectObjects([...pickables.keys()], false);
      return hits[0] ?? null;
    };
    const onClick = (event: MouseEvent) => {
      if (!clickIsForScene(event.target)) return;
      const hit = cast(event);
      if (hit) pickables.get(hit.object)?.(hit, event);
    };
    let pending = 0;
    const onMove = (event: MouseEvent) => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        const over = clickIsForScene(event.target) && cast(event) !== null;
        document.documentElement.style.cursor = over ? 'pointer' : '';
      });
    };
    document.addEventListener('click', onClick);
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(pending);
      document.documentElement.style.cursor = '';
    };
  }, [camera, gl]);
  return null;
}
