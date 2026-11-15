'use client';

import { useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import { type Camera, Vector3 } from 'three';

import { STOP_GAP } from '../editor/file-plan';
import { timeMotion } from '../time-store';

import { landmark, type Place, placeById, PLACES, TOUR, tourStop } from './world-places';

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
 * How far the spyglass has closed, 0 (open sky) → 1 (a round view of the landmark), for a
 * tour position `at` gliding toward `target`. It closes as the voyage nears a stop and opens
 * again on arrival; leaving a stop, or lying at one, it stays open. The map has no spyglass.
 */
export function spyglassAmount(at: number, target: number) {
  const stop = Math.round(at);
  if (stop <= 0) return 0;
  const away = Math.abs(at - stop);
  const approaching = Math.abs(target - stop) < away - 1e-3;
  if (!approaching) return 0;
  const closing = 1 - Math.min(1, Math.max(0, (away - 0.2) / 0.22));
  const opening = Math.min(1, Math.max(0, (away - 0.03) / 0.12));
  return closing * opening;
}

const anchor = new Vector3();
const glass = { amount: 0 };

/** The landmark of a place in the world. */
function landmarkOf(place: Place, out: Vector3) {
  out.set(...landmark(place));
  return out;
}

interface Frame {
  at: number;
  camera: Camera;
  delta: number;
  height: number;
  width: number;
}

function driveSpyglass(element: HTMLElement | null, { at, camera, delta, height, width }: Frame) {
  const size = { height, width };
  // The spyglass closes round the place the voyage is nearing.
  const near = placeById(tourStop(Math.round(at)));
  const wanted = timeMotion.chart ? 0 : spyglassAmount(at, timeMotion.tourTarget);
  glass.amount += (wanted - glass.amount) * (1 - Math.exp(-7 * delta));
  if (element) {
    const shown = glass.amount > 0.004 && near;
    element.style.opacity = shown ? String(Math.min(1, glass.amount * 2.4)) : '0';
    if (shown) {
      landmarkOf(near, anchor);
      anchor.y *= 0.6;
      anchor.project(camera);
      const x = Math.min(0.85, Math.max(0.15, anchor.x * 0.5 + 0.5)) * size.width;
      const y = Math.min(0.8, Math.max(0.2, 1 - (anchor.y * 0.5 + 0.5))) * size.height;
      const open = Math.hypot(size.width, size.height);
      const closed = Math.min(size.width, size.height) * 0.3;
      const radius = open + (closed - open) * (1 - (1 - glass.amount) ** 2);
      element.style.setProperty('--sx', `${x.toFixed(1)}px`);
      element.style.setProperty('--sy', `${y.toFixed(1)}px`);
      element.style.setProperty('--sr', `${radius.toFixed(1)}px`);
    }
  }
}

function driveTether(
  element: HTMLElement | null,
  site: HTMLElement | null,
  { camera, height, width }: Frame
) {
  const size = { height, width };
  // The tether: a line of light from the landmark to whatever is speaking for it.
  if (element) {
    const speaker = site?.querySelector<HTMLElement>('[data-tether]');
    const id = site?.dataset.worldAt || site?.dataset.worldOpen || '';
    const place = speaker ? placeById(id) : undefined;
    if (speaker && place) {
      landmarkOf(place, anchor);
      anchor.y *= 0.72;
      anchor.project(camera);
      const fromX = (anchor.x * 0.5 + 0.5) * size.width;
      const fromY = (1 - (anchor.y * 0.5 + 0.5)) * size.height;
      const rect = speaker.getBoundingClientRect();
      const toX = rect.left;
      const toY = rect.top + Math.min(rect.height / 2, 36);
      const length = Math.hypot(toX - fromX, toY - fromY);
      const angle = Math.atan2(toY - fromY, toX - fromX);
      const onScreen = anchor.z < 1 && fromX > 0 && fromX < toX - 24;
      element.style.opacity = onScreen ? '1' : '0';
      element.style.width = `${length.toFixed(1)}px`;
      element.style.transform = `translate3d(${fromX.toFixed(1)}px, ${fromY.toFixed(1)}px, 0) rotate(${angle.toFixed(4)}rad)`;
    } else {
      element.style.opacity = '0';
    }
  }
}

function driveCompass(element: HTMLElement | null, { at, camera }: Frame) {
  const last = TOUR.length;
  // The compass: progress round the rim, and a needle that swings to the next place.
  if (element) {
    element.style.setProperty('--p', (at / last).toFixed(4));
    const next = placeById(tourStop(Math.min(last, Math.floor(at + 1e-3) + 1)));
    if (next) {
      // Bearing of the next landmark relative to where the camera looks, on the water.
      camera.getWorldDirection(anchor);
      const heading = Math.atan2(anchor.x, -anchor.z);
      landmarkOf(next, anchor);
      const bearing = Math.atan2(anchor.x - camera.position.x, -(anchor.z - camera.position.z));
      element.style.setProperty('--needle', `${(bearing - heading).toFixed(4)}rad`);
    }
  }
}

/**
 * Pins each hotspot label (plain DOM, outside the canvas) to its place's landmark: projects
 * the landmark every frame and moves the label with a transform; places out of frame clamp
 * to the screen edge. Also drives the page's other scene-tied decoration: the tether from a
 * landmark to its title card or panel, the spyglass iris and the compass. Writes straight to
 * the DOM — no React renders per frame.
 */
export function HotspotProjector() {
  const { camera, size } = useThree();
  const cache = useRef<Map<string, HTMLElement>>(new Map());
  const parts = useRef<{
    compass: HTMLElement | null;
    site: HTMLElement | null;
    spyglass: HTMLElement | null;
    tether: HTMLElement | null;
  } | null>(null);
  useFrame((_, rawDelta) => {
    if (cache.current.size === 0) {
      for (const element of document.querySelectorAll<HTMLElement>('[data-hotspot]')) {
        cache.current.set(element.dataset.hotspot ?? '', element);
      }
      if (cache.current.size === 0) return;
      parts.current = {
        compass: document.querySelector<HTMLElement>('.tx-world-compass'),
        site: document.querySelector<HTMLElement>('.wakaclock-marketing[data-world="on"]'),
        spyglass: document.querySelector<HTMLElement>('.tx-world-spyglass'),
        tether: document.querySelector<HTMLElement>('.tx-world-tether'),
      };
    }
    const boxes: Box[] = [];
    for (const place of PLACES) {
      const element = cache.current.get(place.id);
      if (!element) continue;
      landmarkOf(place, point);
      point.y += 2.5;
      point.project(camera);
      const spot = hotspotPosition(point.x, point.y, point.z > 1, size.width, size.height);
      // Along a file every place lies in one line of sight: only the ones near the cursor
      // wear a marker (all of them from the whole-file view).
      const stops = Math.abs(-place.at[1] / STOP_GAP - timeMotion.tour);
      element.dataset.visible = String(timeMotion.chart || stops < 1.35);
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

    const live = parts.current;
    if (!live) return;
    const delta = Math.min(rawDelta, 0.1);
    const last = TOUR.length;
    const at = Math.min(last, Math.max(0, timeMotion.tour));

    const frame = { at, camera, delta, height: size.height, width: size.width };
    driveSpyglass(live.spyglass, frame);
    driveTether(live.tether, live.site, frame);
    driveCompass(live.compass, frame);
  });
  return null;
}
