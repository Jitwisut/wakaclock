'use client';

import { useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';

import { landmark, PLACES } from './world-places';

const point = new Vector3();

/** Screen margins a marker keeps: below the site nav, above the bottom edge. */
export const HOTSPOT_BOUNDS = { top: 84, bottom: 36, side: 22 } as const;

/**
 * Where a hotspot goes on screen for a projected landmark (normalised device coordinates).
 * A place out of frame — beside the screen or behind the camera — is never dropped: its
 * marker clamps to the nearest edge and points toward it, so every place stays reachable by
 * tap and by keyboard on any screen shape.
 */
export function hotspotPosition(
  ndcX: number,
  ndcY: number,
  behind: boolean,
  width: number,
  height: number
) {
  let x = (ndcX * 0.5 + 0.5) * width;
  let y = (1 - (ndcY * 0.5 + 0.5)) * height;
  if (behind) {
    // Behind the camera the projection mirrors: send the marker to the side it really is on.
    x = ndcX > 0 ? 0 : width;
    y = height * 0.5;
  }
  const { bottom, side, top } = HOTSPOT_BOUNDS;
  let edge: '' | 'left' | 'right' = '';
  if (x < side) edge = 'left';
  else if (x > width - side) edge = 'right';
  return {
    edge,
    x: Math.min(width - side, Math.max(side, x)),
    y: Math.min(height - bottom, Math.max(top, y)),
  };
}

interface Box {
  element: HTMLElement;
  height: number;
  width: number;
  x: number;
  y: number;
}

/**
 * Nudges labels that would overlap: placed top to bottom, each one that collides with a
 * label already placed moves down until it is clear. Few labels, so a simple pass is enough.
 */
export function separate(boxes: Box[], gap = 4) {
  const placed: Box[] = [];
  for (const box of [...boxes].sort((a, b) => a.y - b.y)) {
    let moved = true;
    while (moved) {
      moved = false;
      for (const other of placed) {
        const overlapX = box.x < other.x + other.width + gap && other.x < box.x + box.width + gap;
        const overlapY = box.y < other.y + other.height + gap && other.y < box.y + box.height + gap;
        if (overlapX && overlapY) {
          box.y = other.y + other.height + gap;
          moved = true;
        }
      }
    }
    placed.push(box);
  }
  return placed;
}

/**
 * Pins each hotspot label (plain DOM, outside the canvas) to its place's landmark: projects
 * the landmark every frame and moves the label with a transform; places out of frame clamp
 * to the screen edge. Writes straight to the DOM — no React renders per frame.
 */
export function HotspotProjector() {
  const { camera, size } = useThree();
  const cache = useRef<Map<string, HTMLElement>>(new Map());
  useFrame(() => {
    if (cache.current.size === 0) {
      for (const element of document.querySelectorAll<HTMLElement>('[data-hotspot]')) {
        cache.current.set(element.dataset.hotspot ?? '', element);
      }
      if (cache.current.size === 0) return;
    }
    const boxes: Box[] = [];
    for (const place of PLACES) {
      const element = cache.current.get(place.id);
      if (!element) continue;
      point.set(...landmark(place));
      point.y += 2.5;
      point.project(camera);
      const spot = hotspotPosition(point.x, point.y, point.z > 1, size.width, size.height);
      element.dataset.visible = 'true';
      element.dataset.edge = spot.edge;
      const label = element.firstElementChild as HTMLElement | null;
      boxes.push({
        element,
        x: spot.x - 14,
        y: spot.y - 16,
        width: label?.offsetWidth ?? 30,
        height: label?.offsetHeight ?? 30,
      });
    }
    for (const box of separate(boxes)) {
      box.element.style.transform = `translate3d(${(box.x + 14).toFixed(1)}px, ${(box.y + 16).toFixed(1)}px, 0)`;
    }
  });
  return null;
}
